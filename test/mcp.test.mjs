import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { pdfFixture } from './pdf-fixture.mjs';

const serverFile = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const unpack = result => result.structuredContent || JSON.parse(result.content[0].text);

async function unusedPort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('real MCP stdio and HTTP clients share documents with the browser API', { timeout: 30000 }, async t => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'folio-mcp-test-'));
  const port = await unusedPort(), base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [serverFile, '--data-dir', dataDir, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
  t.after(() => child.kill());
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(`${base}/api/info`)).ok; if (ready) break; } catch {}
    await delay(100);
  }
  assert.ok(ready, stderr);
  const stdio = new Client({ name: 'codex-compatible-test', version: '1.0.0' });
  await stdio.connect(new StdioClientTransport({ command: process.execPath, args: [serverFile, '--stdio', '--data-dir', dataDir], stderr: 'pipe' }));
  t.after(() => stdio.close());
  const http = new Client({ name: 'claude-compatible-test', version: '1.0.0' });
  await http.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  t.after(() => http.close());
  const tools = await stdio.listTools();
  assert.ok(tools.tools.some(tool => tool.name === 'folio_replace_text'));
  assert.equal(tools.tools.length, 38);
  const reference = unpack(await stdio.callTool({name:'folio_save_reference_record',arguments:{data:{title:'Protocol bibliography',type:'article-journal'}}}));
  assert.equal((await (await fetch(`${base}/api/references`)).json()).items[0].id,reference.id);
  assert.match(unpack(await http.callTool({name:'folio_format_references',arguments:{ids:[reference.id],style:'apa'}})).bibliography,/Protocol bibliography/);
  const created = unpack(await stdio.callTool({ name: 'folio_create_project', arguments: { name: 'Protocol test', files: { 'main.tex': '\\begin{document}\nOriginal\n\\end{document}' } } }));
  const browser = await (await fetch(`${base}/api/projects/${created.id}`)).json();
  assert.match(browser.files['main.tex'], /Original/);
  const a = unpack(await stdio.callTool({ name: 'folio_read_file', arguments: { project_id: created.id, filename: 'main.tex' } }));
  const b = unpack(await http.callTool({ name: 'folio_read_file', arguments: { project_id: created.id, filename: 'main.tex' } }));
  assert.equal(a.revision, b.revision);
  const updated = unpack(await http.callTool({ name: 'folio_replace_text', arguments: { project_id: created.id, expected_revision: b.revision, filename: 'main.tex', search: 'Original', replacement: 'Agent update' } }));
  assert.equal(updated.revision, 2);
  const stale = await stdio.callTool({ name: 'folio_write_file', arguments: { project_id: created.id, expected_revision: a.revision, filename: 'main.tex', content: 'Stale write' } });
  assert.equal(stale.isError, true);
  assert.equal(unpack(stale).code, 'REVISION_CONFLICT');
  const next = await (await fetch(`${base}/api/projects/${created.id}`)).json();
  assert.match(next.files['main.tex'], /Agent update/);
  const write = await fetch(`${base}/api/projects/${created.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: next.name, files: { 'main.tex': 'Browser update' }, expected_revision: next.revision }) });
  assert.equal(write.status, 200);
  assert.equal(unpack(await stdio.callTool({ name: 'folio_read_file', arguments: { project_id: created.id, filename: 'main.tex' } })).content, 'Browser update');
  const resource = await http.readResource({ uri: `folio://projects/${created.id}` });
  assert.match(resource.contents[0].text, /Browser update/);
  assert.equal((await stdio.listResources()).resources[0].uri, 'folio://projects');
  const invalid = await http.callTool({ name: 'folio_write_file', arguments: { project_id: created.id, expected_revision: 3, filename: '../escape.tex', content: 'no' } });
  assert.equal(unpack(invalid).code, 'INVALID_FILENAME');
  const foreignOrigin = await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: JSON.stringify({ name: 'Blocked' }) });
  assert.equal(foreignOrigin.status, 403);
  // fetch normalizes Host; use raw HTTP to exercise DNS rebinding protection.
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${base}/api/projects`, { headers: { Host: `unrelated.example:${port}` } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(foreignHostStatus, 403);
  const wrongType = await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"name":"Blocked"}' });
  assert.equal(wrongType.status, 415);
  assert.equal((await fetch(`${base}/vendor/mathjax/tex-chtml.js`)).status, 200);
  const pdfResponse = await fetch(`${base}/api/papers`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pdf_base64:pdfFixture().toString('base64'), metadata:{title:'MCP paper'}}) });
  assert.equal(pdfResponse.status,201);
  const paper = await pdfResponse.json();
  assert.equal(unpack(await stdio.callTool({name:'folio_list_papers',arguments:{query:'MCP paper'}})).papers[0].id,paper.id);
  const page = unpack(await http.callTool({name:'folio_read_paper_page',arguments:{paper_id:paper.id,page:1}}));
  assert.match(page.text,/Evidence from/);
  const view = await stdio.callTool({ name:'folio_view_paper_page', arguments:{paper_id:paper.id,page:1} });
  assert.equal(view.content[0].type,'image');
  assert.equal(Buffer.from(view.content[0].data,'base64').subarray(1,4).toString(),'PNG');
  const pageResource = await stdio.readResource({uri:page.citation});
  assert.match(pageResource.contents[0].text,/Evidence from/);
  const question = await (await fetch(`${base}/api/papers/${paper.id}/requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:1,quote:'Evidence from the first page.',question:'Explain this.'})})).json();
  assert.equal(unpack(await stdio.callTool({name:'folio_pending_requests',arguments:{}})).requests[0].id,question.id);
  await http.callTool({name:'folio_answer_request',arguments:{request_id:question.id,answer:'Source statement on page 1.',agent:'Test agent'}});
  const info = await (await fetch(`${base}/api/papers/${paper.id}`)).json();
  assert.equal(info.requests[0].answer,'Source statement on page 1.');
  assert.equal((await fetch(`${base}/api/papers/${paper.id}/pdf`)).headers.get('content-type'),'application/pdf');
});
