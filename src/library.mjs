import { randomUUID, createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceError, fileName } from './store.mjs';

const fail = (message, code = 'INVALID_RESEARCH_DATA', status = 400) => { throw new WorkspaceError(code, message, status); };
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`텍스트는 ${required ? '1' : '0'}–${max}자여야 합니다.`);
  return value.trim();
};
const normalize = value => value.replace(/\s+/g, ' ').trim();
const texEscape = value => value.replace(/[\\{}%$&#_^~]/g, c => ({ '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '%': '\\%', '$': '\\$', '&': '\\&', '#': '\\#', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}' }[c]));

function parsePdf(bytes, page) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url), { workerData: { bytes, page }, resourceLimits: { maxOldGenerationSizeMb: 256 }, stdout: true, stderr: true });
    worker.stdout.resume(); worker.stderr.resume();
    const timer = setTimeout(() => { worker.terminate(); reject(new WorkspaceError('PDF_TIMEOUT', 'PDF 처리 제한 시간(45초)을 초과했습니다.')); }, 45000);
    worker.once('message', result => { clearTimeout(timer); worker.terminate(); result.error ? reject(new WorkspaceError('INVALID_PDF', result.error)) : resolve(result); });
    worker.once('error', error => { clearTimeout(timer); reject(new WorkspaceError('INVALID_PDF', error.message)); });
    worker.once('exit', () => { clearTimeout(timer); reject(new WorkspaceError('INVALID_PDF', 'PDF 처리 프로세스가 종료됐습니다.')); });
  });
}

export class Library {
  constructor(store) {
    this.store = store; this.db = store.db; this.importing = false; this.ocrRunning = null; this.closed = false;
    this.db.exec(`CREATE TABLE IF NOT EXISTS papers (id TEXT PRIMARY KEY, sha TEXT UNIQUE NOT NULL, metadata TEXT NOT NULL, pages TEXT NOT NULL, pdf BLOB NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_notes (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, page INTEGER NOT NULL, quote TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_requests (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, page INTEGER NOT NULL, quote TEXT NOT NULL, question TEXT NOT NULL, status TEXT NOT NULL, answer TEXT NOT NULL, agent TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS notes_paper ON research_notes(paper_id);
      CREATE INDEX IF NOT EXISTS requests_paper ON research_requests(paper_id);`);
    this.db.exec("CREATE TABLE IF NOT EXISTS paper_ocr (paper_id TEXT NOT NULL, page INTEGER NOT NULL, status TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', confidence REAL NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '', lease INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(paper_id,page))");
  }
  metadata(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('서지 정보는 객체여야 합니다.');
    const result = {};
    for (const [key, max] of Object.entries({ title: 500, authors: 1000, year: 4, doi: 200, citekey: 80, tags: 500 })) result[key] = text(input[key] ?? '', max, key === 'title' || key === 'citekey');
    if (!/^[A-Za-z][A-Za-z0-9_:-]*$/.test(result.citekey)) fail('인용 키는 영문자로 시작하고 영문·숫자·_:-만 사용하세요.');
    if (result.year && !/^\d{4}$/.test(result.year)) fail('연도는 네 자리 숫자입니다.');
    if (result.doi && !/^10\.\d{4,9}\/\S+$/i.test(result.doi)) fail('DOI 형식: 10.xxxx/…');
    return result;
  }
  row(id) {
    const row = this.db.prepare('SELECT id, metadata, pages, revision, created_at FROM papers WHERE id=?').get(text(id, 50, true));
    if (!row) fail('논문을 찾지 못했습니다.', 'NOT_FOUND', 404);
    const pages = JSON.parse(row.pages);
    for (const ocr of this.db.prepare("SELECT page,text FROM paper_ocr WHERE paper_id=? AND status='done'").all(id)) if (!pages[ocr.page-1].trim()) pages[ocr.page-1] = ocr.text;
    return { ...JSON.parse(row.metadata), id: row.id, revision: row.revision, created_at: row.created_at, pages };
  }
  info(id) { const { pages, ...paper } = this.row(id); return { ...paper, page_count: pages.length, text_available: pages.some(p => p.trim()), ocr: this.ocrStatus(id), notes: this.notes(id), requests: this.requests(id) }; }
  ocrStatus(id) { return this.db.prepare('SELECT page,status,confidence,error FROM paper_ocr WHERE paper_id=? ORDER BY page').all(id); }
  queueOcr(id) {
    const paper = this.row(id);
    paper.pages.forEach((content,i) => { if (!content.trim()) this.db.prepare("INSERT INTO paper_ocr(paper_id,page,status) VALUES(?,?,'queued') ON CONFLICT(paper_id,page) DO UPDATE SET status=CASE WHEN status='error' THEN 'queued' ELSE status END").run(id,i+1); });
    void this.runOcr().catch(error => { if (!this.closed) console.error('OCR:',error.message); });
    return { paper_id:id, pages:this.ocrStatus(id) };
  }
  runOcr() {
    if (this.ocrRunning) return this.ocrRunning;
    this.ocrRunning = this.drainOcr().finally(() => { this.ocrRunning = null; });
    return this.ocrRunning;
  }
  async drainOcr() {
    while (!this.closed) {
      const now = Date.now();
      const job = this.db.prepare("UPDATE paper_ocr SET status='processing',lease=? WHERE rowid=(SELECT rowid FROM paper_ocr WHERE status='queued' OR (status='processing' AND lease<?) LIMIT 1) RETURNING *").get(now+150000,now);
      if (!job) return;
      try {
        const result = await new Promise((resolve,reject) => {
          const worker = new Worker(new URL('./ocr-worker.mjs',import.meta.url),{workerData:{bytes:this.pdf(job.paper_id),page:job.page,modelDir:path.join(this.store.dataDir,'ocr-models')},resourceLimits:{maxOldGenerationSizeMb:512},stdout:true,stderr:true});
          this.ocrWorker = worker; worker.stdout.resume(); worker.stderr.resume();
          const timer = setTimeout(() => { worker.terminate(); reject(new Error('OCR 페이지 처리 시간(120초)을 초과했습니다.')); },120000);
          worker.once('message',value => { clearTimeout(timer); worker.terminate(); value.error?reject(new Error(value.error)):resolve(value); });
          worker.once('error',error => { clearTimeout(timer); reject(error); });
          worker.once('exit',() => { clearTimeout(timer); reject(new Error('OCR 프로세스 종료')); });
        });
        if (!this.closed) this.db.prepare("UPDATE paper_ocr SET status='done',text=?,confidence=?,error='' WHERE paper_id=? AND page=? AND lease=?").run(result.text,result.confidence,job.paper_id,job.page,job.lease);
      } catch(error) {
        if (!this.closed) this.db.prepare("UPDATE paper_ocr SET status='error',error=? WHERE paper_id=? AND page=? AND lease=?").run(error.message,job.paper_id,job.page,job.lease);
      } finally { this.ocrWorker = null; }
    }
  }
  async close() { this.closed = true; if(this.ocrWorker)await this.ocrWorker.terminate(); if(this.ocrRunning)await this.ocrRunning; }
  list(query = '') {
    query = text(query, 200).toLowerCase();
    return this.db.prepare('SELECT id,metadata,revision,created_at FROM papers ORDER BY created_at DESC').all().map(r => ({ ...JSON.parse(r.metadata), id: r.id, revision: r.revision, created_at: r.created_at })).filter(r => !query || [r.title, r.authors, r.tags, r.doi].join(' ').toLowerCase().includes(query));
  }
  async importFile(filename, metadata = {}) {
    if (!path.isAbsolute(filename)) fail('PDF 경로는 절대 경로여야 합니다.');
    const s = await stat(filename);
    if (!s.isFile() || s.size > 20 * 1024 * 1024) fail('PDF 파일은 20 MiB 이하입니다.');
    return this.importPdf(await readFile(filename), metadata);
  }
  async importPdf(bytes, metadata = {}) {
    if (!Buffer.isBuffer(bytes) || bytes.length > 20 * 1024 * 1024 || !bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) fail('20 MiB 이하의 PDF가 필요합니다.');
    const sha = createHash('sha256').update(bytes).digest('hex');
    const existing = this.db.prepare('SELECT id FROM papers WHERE sha=?').get(sha);
    if (existing) { this.queueOcr(existing.id); return { ...this.info(existing.id), duplicate: true }; }
    if (this.importing) fail('PDF 가져오기가 진행 중입니다. 잠시 후 다시 시도하세요.', 'IMPORT_BUSY', 409);
    this.importing = true;
    try {
      const parsed = await parsePdf(bytes);
      const id = randomUUID();
      const meta = this.metadata({ title: parsed.title || 'Untitled paper', authors: parsed.authors, citekey: `paper_${sha.slice(0, 10)}`, ...metadata });
      this.db.prepare('INSERT OR IGNORE INTO papers VALUES(?,?,?,?,?,1,?)').run(id, sha, JSON.stringify(meta), JSON.stringify(parsed.pages), bytes, new Date().toISOString());
      const importedId = this.db.prepare('SELECT id FROM papers WHERE sha=?').get(sha).id;
      this.queueOcr(importedId);
      return this.info(importedId);
    } finally { this.importing = false; }
  }
  update(id, revision, metadata) {
    if (!Number.isSafeInteger(revision) || revision < 1) fail('현재 논문 revision이 필요합니다.');
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('서지 정보는 객체여야 합니다.');
    const current = this.row(id);
    const meta = this.metadata({ ...current, ...metadata });
    const result = this.db.prepare('UPDATE papers SET metadata=?, revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(meta), id, revision);
    if (!result.changes) fail('서지 정보가 변경됐습니다. 다시 읽은 후 수정하세요.', 'REVISION_CONFLICT', 409);
    return this.info(id);
  }
  pdf(id) { this.row(id); return Buffer.from(this.db.prepare('SELECT pdf FROM papers WHERE id=?').get(id).pdf); }
  async pageImage(id, page) {
    const source = this.page(id, page);
    return { ...await parsePdf(this.pdf(id), page), paper_id: id, page, citation: source.citation };
  }
  page(id, page) {
    const paper = this.row(id);
    if (!Number.isInteger(page) || page < 1 || page > paper.pages.length) fail('페이지 번호가 범위를 벗어났습니다.');
    const ocr = this.ocrStatus(id).find(item => item.page === page);
    return { paper_id: id, title: paper.title, page, page_count: paper.pages.length, text: paper.pages[page - 1], text_source: ocr?.status === 'done' ? 'ocr' : 'pdf', ocr, citation: `folio://papers/${id}/pages/${page}` };
  }
  search(id, query) {
    query = text(query, 200, true).toLowerCase();
    return this.row(id).pages.flatMap((content, i) => { const at = content.toLowerCase().indexOf(query); return at < 0 ? [] : [{ page: i + 1, excerpt: content.slice(Math.max(0, at - 100), at + query.length + 200) }]; }).slice(0, 100);
  }
  anchor(id, page, quote) {
    const source = this.page(id, page);
    quote = text(quote, 10000);
    if (quote && !normalize(source.text).includes(normalize(quote))) fail('선택한 인용문이 이 페이지의 추출 텍스트와 일치하지 않습니다. 추출 텍스트에서 다시 선택하세요.', 'QUOTE_MISMATCH');
    return quote;
  }
  notes(id) { return this.db.prepare('SELECT * FROM research_notes WHERE paper_id=? ORDER BY created_at DESC').all(id); }
  addNote(id, page, quote, body, kind = 'note') {
    quote = this.anchor(id, page, quote); body = text(body, 20000, true);
    if (!['note', 'summary', 'translation', 'explanation'].includes(kind)) fail('메모 종류가 잘못됐습니다.');
    const note = { id: randomUUID(), paper_id: id, page, quote, body, kind, created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO research_notes VALUES(?,?,?,?,?,?,?)').run(...Object.values(note)); return note;
  }
  requests(id) { return id ? this.db.prepare('SELECT * FROM research_requests WHERE paper_id=? ORDER BY created_at DESC').all(id) : this.db.prepare("SELECT * FROM research_requests WHERE status='pending' ORDER BY created_at").all(); }
  request(id, page, quote, question) {
    quote = this.anchor(id, page, quote); question = text(question, 4000, true);
    const item = { id: randomUUID(), paper_id: id, page, quote, question, status: 'pending', answer: '', agent: '', created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO research_requests VALUES(?,?,?,?,?,?,?,?,?)').run(...Object.values(item)); return item;
  }
  answer(id, answer, agent) {
    answer = text(answer, 20000, true); agent = text(agent, 120, true);
    const result = this.db.prepare("UPDATE research_requests SET answer=?,agent=?,status='answered' WHERE id=? AND status='pending'").run(answer, agent, id);
    if (!result.changes) fail('요청이 없거나 이미 답변됐습니다.', 'REQUEST_CONFLICT', 409);
    return this.db.prepare('SELECT * FROM research_requests WHERE id=?').get(id);
  }
  cite({ paper_id, project_id, expected_revision, filename, page, note_id }) {
    fileName(filename);
    if (!filename.endsWith('.tex')) fail('인용은 .tex 원고에 추가할 수 있습니다.');
    const paper = this.row(paper_id); this.page(paper_id, page);
    const note = note_id ? this.notes(paper_id).find(n => n.id === note_id && n.page === page) : null;
    if (note_id && !note) fail('이 논문·페이지의 메모가 아닙니다.');
    const fields = [['title', paper.title], ['author', paper.authors], ['year', paper.year], ['doi', paper.doi]].filter(([,v]) => v).map(([k,v]) => `  ${k} = {${texEscape(v)}}`).join(',\n');
    const entry = `@misc{${paper.citekey},\n${fields}\n}`;
    return this.store.update(project_id, expected_revision, project => {
      const source = project.files[filename];
      if (typeof source !== 'string') fail('원고 파일을 찾지 못했습니다.');
      const bib = project.files['references.bib'] || '';
      const matches = [...bib.matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)].filter(m => m[1] === paper.citekey);
      if (matches.length && !bib.includes(entry)) fail('같은 인용 키의 다른 서지 정보가 있습니다. 인용 키를 바꾸거나 references.bib를 검토하세요.', 'CITEKEY_CONFLICT', 409);
      if (!matches.length) project.files['references.bib'] = `${bib.trim()}\n\n${entry}\n`.trimStart();
      const body = `${note ? texEscape(note.body) + ' ' : ''}\\cite[p.~${page}]{${paper.citekey}}\n% Source: folio://papers/${paper_id}/pages/${page}${note ? ` note=${note.id}` : ''}\n`;
      const end = source.lastIndexOf('\\end{document}');
      const bibliography = /\\(?:bibliographystyle|bibliography|printbibliography)\b/.exec(source);
      const at = bibliography ? bibliography.index : end;
      const setup = end >= 0 && !bibliography && !source.includes('biblatex') ? '\\bibliographystyle{plain}\n\\bibliography{references}\n' : '';
      project.files[filename] = at < 0 ? source + '\n' + body : source.slice(0, at) + '\n' + body + setup + source.slice(at);
    });
  }
}
