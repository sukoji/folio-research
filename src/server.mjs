import express from 'express';
import { Accounts } from '../desktop/auth.mjs';
import { importArchive, exportArchive } from './archive.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Store, WorkspaceError } from './store.mjs';
import { createMcpServer } from './mcp.mjs';
import { Library } from './library.mjs';
import { Compiler } from './compiler.mjs';
import { Discovery } from './discovery.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { stdio: { type: 'boolean' }, 'data-dir': { type: 'string' }, port: { type: 'string' }, help: { type: 'boolean' } } });
if (values.help) {
  console.log('Folio: node src/server.mjs [--stdio] [--data-dir PATH] [--port 4317]\nDefault: local browser UI and MCP HTTP endpoint. --stdio: agent-launched MCP process only. Both share the same data directory.');
  process.exit(0);
}
let port = Number(values.port || process.env.FOLIO_PORT || 4317);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid Folio port.');
const store = new Store(values['data-dir'] || process.env.FOLIO_DATA_DIR || path.join(root, 'data'));
const library = new Library(store);
const compiler = new Compiler(store), discovery = new Discovery(store);
const resumeOcr = () => void library.runOcr().catch(error => console.error('OCR:',error.message));
resumeOcr(); const ocrTimer = setInterval(resumeOcr,30000); ocrTimer.unref();

if (values.stdio) {
  const server = createMcpServer(store, { port, library, compiler, discovery });
  await server.connect(new StdioServerTransport());
  let closing = false;
  async function close() { if (closing) return; closing = true; clearInterval(ocrTimer); await server.close(); await library.close(); store.close(); }
  process.stdin.on('end', close);
  process.on('SIGINT', async () => { await close(); process.exit(0); });
  process.on('SIGTERM', async () => { await close(); process.exit(0); });
} else {
  let authorizationUrl;
  const accounts=new Accounts(store.dataDir,null,url=>{authorizationUrl=url;},{sessionOnly:true});
  const app = express();
  app.disable('x-powered-by');
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set([...hosts].map(host => `http://${host}`));
  // Loopback binding alone does not prevent a malicious website from sending
  // local requests. Reject foreign Host/Origin and non-JSON writes as well.
  app.use((req, res, next) => {
    if (!hosts.has(req.headers.host) || (req.headers.origin && !origins.has(req.headers.origin))) return res.status(403).json({ error: 'ORIGIN_FORBIDDEN' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: 'JSON_REQUIRED' });
    next();
  });
  app.use(express.json({ limit: '29mb' }));
  app.get('/api/account/status',(_req,res)=>res.json({...accounts.status(),sessionOnly:true}));
  for(const action of ['login','cancel','select','logout','models','ask']) app.post(`/api/account/${action}`,async(req,res)=>{try {authorizationUrl=undefined;const result=await accounts[action](req.body.argument);res.json({result:result??null,...(action==='login'?{authorization_url:authorizationUrl}:{})});}catch(error){throw new WorkspaceError('ACCOUNT_ERROR',error.message);}});
  app.get('/api/discover', async (req,res) => res.json(await discovery.search(req.query.q)));
  app.get('/api/reading-list',(req,res) => res.json({items:discovery.list()}));
  app.post('/api/reading-list',(req,res) => res.status(201).json(discovery.save(req.body)));
  app.post('/api/papers/:id/recommend',async (req,res) => { const paper = library.row(req.params.id); res.json(await discovery.search(paper.title.slice(0,300),{excludeDoi:paper.doi})); });
  app.post('/api/papers/:id/ocr',(req,res) => res.json(library.queueOcr(req.params.id)));
  app.post('/api/projects/:id/compile',async (req,res) => res.json(await compiler.compile(req.params.id,req.body.expected_revision,req.body.filename)));
  app.get('/api/builds/:id/pdf',(req,res) => res.set('Content-Disposition','inline; filename="manuscript.pdf"').sendFile(compiler.pdf(req.params.id)));
  app.get('/api/papers', (req, res) => res.json({ papers: library.list(req.query.q || '') }));
  app.post('/api/papers', async (req, res) => {
    if (typeof req.body.pdf_base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(req.body.pdf_base64)) throw new WorkspaceError('INVALID_PDF', 'PDF 데이터가 잘못됐습니다.');
    res.status(201).json(await library.importPdf(Buffer.from(req.body.pdf_base64, 'base64'), req.body.metadata));
  });
  app.get('/api/papers/:id', (req, res) => res.json(library.info(req.params.id)));
  app.put('/api/papers/:id', (req, res) => res.json(library.update(req.params.id, req.body.expected_revision, req.body.metadata)));
  app.get('/api/papers/:id/pdf', (req, res) => res.type('application/pdf').send(library.pdf(req.params.id)));
  app.get('/api/papers/:id/pages/:page', (req, res) => res.json(library.page(req.params.id, Number(req.params.page))));
  app.get('/api/papers/:id/search', (req, res) => res.json({ results: library.search(req.params.id, req.query.q) }));
  app.post('/api/papers/:id/notes', (req, res) => res.status(201).json(library.addNote(req.params.id, req.body.page, req.body.quote || '', req.body.body, req.body.kind)));
  app.post('/api/papers/:id/requests', (req, res) => res.status(201).json(library.request(req.params.id, req.body.page, req.body.quote || '', req.body.question)));
  app.post('/api/papers/:id/cite', (req, res) => res.json(library.cite({ ...req.body, paper_id: req.params.id })));
  app.get('/api/info', (req, res) => res.json({ name: 'Folio', version: '1.2.0', mcp_url: `http://127.0.0.1:${port}/mcp`, storage: 'local-sqlite', stdio: { command: process.execPath, args: [path.join(root, 'src/server.mjs'), '--stdio', '--data-dir', store.dataDir, '--port', String(port)] } }));
  app.post('/api/import', async (req,res) => { if(typeof req.body.zip_base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(req.body.zip_base64)) throw new WorkspaceError('INVALID_ZIP','ZIP 데이터가 잘못됐습니다.'); res.status(201).json(await importArchive(store, Buffer.from(req.body.zip_base64,'base64'), req.body.name)); });
  app.get('/api/projects/:id/archive', (req,res,next) => { res.type('application/zip').attachment('folio-project.zip'); exportArchive(store,req.params.id).on('error',next).pipe(res); });
  app.get('/api/projects', (req, res) => res.json({ projects: store.list() }));
  app.post('/api/projects', (req, res) => res.status(201).json(store.create(req.body.name, req.body.files)));
  app.get('/api/projects/:id', (req, res) => res.json(store.get(req.params.id)));
  app.put('/api/projects/:id', (req, res) => res.json(store.replace(req.params.id, req.body.expected_revision, req.body.name, req.body.files)));
  app.get('/api/projects/:id/history', (req, res) => res.json({ revisions: store.history(req.params.id) }));
  app.post('/api/projects/:id/restore', (req, res) => res.json(store.restore(req.params.id, req.body.expected_revision, req.body.restore_revision)));
  app.post('/mcp', async (req, res, next) => {
    const server = createMcpServer(store, { port, library, compiler, discovery });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch (error) { next(error); }
  });
  app.all('/mcp', (req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Use MCP Streamable HTTP POST.' }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use('/vendor/mathjax', express.static(path.join(root, 'node_modules/mathjax/es5'), { maxAge: '1d' }));
  app.use('/vendor/pdfjs', express.static(path.join(root, 'node_modules/pdfjs-dist'), { maxAge: '1d' }));
  app.use(express.static(path.join(root, 'web'), { etag: false, maxAge: 0 }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const known = error instanceof WorkspaceError;
    if (!known) console.error(error.message);
    res.status(known ? error.status : (error.status || 500)).json({ code: known ? error.code : 'REQUEST_FAILED', message: known ? error.message : 'Request could not be completed.' });
  });
  const listener = app.listen(port, '127.0.0.1', () => {
    port=listener.address().port; for(const host of [`127.0.0.1:${port}`,`localhost:${port}`]){hosts.add(host);origins.add(`http://${host}`);} process.send?.({port});
    console.error(`Folio editor: http://127.0.0.1:${port}\nMCP HTTP: http://127.0.0.1:${port}/mcp\nData: ${store.dataDir}`);
  });
  listener.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Open the running Folio app or choose --port.` : error.message); store.close(); process.exitCode = 1; });
  const close = () => { accounts.cancel(); return listener.close(async () => { clearInterval(ocrTimer); await library.close(); store.close(); process.exit(0); }); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
