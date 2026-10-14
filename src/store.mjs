import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export class WorkspaceError extends Error {
  constructor(code, message, status = 400) {
    super(message); this.code = code; this.status = status;
  }
}

export const starter = String.raw`\documentclass{article}
\usepackage{amsmath}
\title{My Research Paper}
\author{Your Name}
\begin{document}
\maketitle

\begin{abstract}
Describe the research question and main findings here.
\end{abstract}

\section{Introduction}
Write your introduction. An inline equation: $E = mc^2$.

\section{Methods}
\begin{equation}
f(x) = \sum_{i=1}^{n} x_i
\end{equation}

\section{Conclusion}
Summarize your findings.
\end{document}
`;

function projectId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new WorkspaceError('INVALID_ID', 'Invalid project ID.');
}

export function fileName(name) {
  if (typeof name !== 'string' || name.length > 180 || !/\.(tex|bib|md|txt|cls|sty|bst|csv|bbx|cbx|lbx|def|cfg|clo|bbl|tikz|pgf|dat)$/i.test(name)) {
    throw new WorkspaceError('INVALID_FILENAME', 'Use a .tex, .bib, .md, .txt, .cls, .sty, .bst or .csv filename.');
  }
  const parts = name.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[\\:*?"<>|\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new WorkspaceError('INVALID_FILENAME', 'Filename must be a safe relative project path.');
  }
  return name;
}

function projectName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) throw new WorkspaceError('INVALID_NAME', 'Project name must contain 1–120 characters.');
  return name.trim();
}

function validateFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new WorkspaceError('INVALID_FILES', 'Expected a filename-to-text object.');
  const entries = Object.entries(files);
  if (!entries.length || entries.length > 100) throw new WorkspaceError('INVALID_FILES', 'A project must contain 1–100 files.');
  let total = 0;
  const seen = new Set();
  for (const [name, content] of entries) {
    fileName(name);
    if (seen.has(name.toLowerCase())) throw new WorkspaceError('INVALID_FILENAME', 'Filenames must also be unique ignoring case.');
    seen.add(name.toLowerCase());
    if (typeof content !== 'string' || Buffer.byteLength(content) > 2 * 1024 * 1024) throw new WorkspaceError('FILE_TOO_LARGE', 'Each file must be UTF-8 text of at most 2 MiB.');
    total += Buffer.byteLength(content);
  }
  if (total > 8 * 1024 * 1024) throw new WorkspaceError('PROJECT_TOO_LARGE', 'Project text exceeds 8 MiB.');
  return Object.fromEntries(entries);
}

export class Store {
  constructor(dataDir) {
    this.dataDir = path.resolve(dataDir);
    mkdirSync(this.dataDir, { recursive: true });
    this.db = new DatabaseSync(path.join(this.dataDir, 'folio.sqlite'));
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, files TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (project_id TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT NOT NULL, files TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(project_id, revision));
      CREATE TABLE IF NOT EXISTS project_assets(project_id TEXT NOT NULL, name TEXT NOT NULL, content BLOB NOT NULL, PRIMARY KEY(project_id,name));`);
  }

  close() { this.db.close(); }

  list() {
    return this.db.prepare('SELECT id, name, revision, updated_at FROM projects ORDER BY updated_at DESC').all();
  }

  get(id) {
    projectId(id);
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!row) throw new WorkspaceError('NOT_FOUND', 'Project not found.', 404);
    return { ...row, files: JSON.parse(row.files), assets: this.db.prepare('SELECT name, length(content) AS bytes FROM project_assets WHERE project_id=?').all(id) };
  }

  create(name, files = { 'main.tex': starter, 'references.bib': '' }, assets = []) {
    const item = { id: randomUUID(), name: projectName(name), files: validateFiles(files), revision: 1, updated_at: new Date().toISOString() };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?)').run(item.id, item.name, JSON.stringify(item.files), item.revision, item.updated_at);
      for (const asset of assets) this.db.prepare('INSERT INTO project_assets VALUES(?,?,?)').run(item.id, asset.name, asset.bytes);
      this.snapshot(item);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.get(item.id);
  }

  assets(id) { this.get(id); return this.db.prepare('SELECT name, content FROM project_assets WHERE project_id=?').all(id); }

  snapshot(item) {
    this.db.prepare('INSERT INTO history VALUES (?, ?, ?, ?, ?)').run(item.id, item.revision, item.name, JSON.stringify(item.files), item.updated_at);
  }

  // A SQLite write transaction and expected revision protect across processes,
  // including separate stdio servers started by Codex and Claude Code.
  update(id, expectedRevision, modify) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new WorkspaceError('REVISION_REQUIRED', 'Read the project and pass its expected_revision before editing.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const item = this.get(id);
      if (item.revision !== expectedRevision) throw new WorkspaceError('REVISION_CONFLICT', `Project changed: expected revision ${expectedRevision}, current ${item.revision}. Read it again and reconcile your edit.`, 409);
      modify(item);
      item.name = projectName(item.name);
      item.files = validateFiles(item.files);
      const assetNames = new Set(item.assets.map(a => a.name.toLowerCase()));
      if (Object.keys(item.files).some(n => assetNames.has(n.toLowerCase()))) throw new WorkspaceError('FILE_COLLISION','An asset already uses that filename.');
      item.revision++;
      item.updated_at = new Date().toISOString();
      this.db.prepare('UPDATE projects SET name=?, files=?, revision=?, updated_at=? WHERE id=?').run(item.name, JSON.stringify(item.files), item.revision, item.updated_at, id);
      this.snapshot(item);
      this.db.exec('COMMIT');
      return item;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  replace(id, expectedRevision, name, files) {
    return this.update(id, expectedRevision, item => { item.name = name; item.files = files; });
  }

  readFile(id, filename) {
    fileName(filename);
    const item = this.get(id);
    if (!Object.hasOwn(item.files, filename)) throw new WorkspaceError('NOT_FOUND', 'File not found.', 404);
    return { project_id: id, filename, revision: item.revision, content: item.files[filename] };
  }

  writeFile(id, expectedRevision, filename, content) {
    fileName(filename);
    return this.update(id, expectedRevision, item => { item.files[filename] = content; });
  }

  replaceText(id, expectedRevision, filename, search, replacement) {
    fileName(filename);
    if (typeof search !== 'string' || !search) throw new WorkspaceError('INVALID_SEARCH', 'Search text cannot be empty.');
    return this.update(id, expectedRevision, item => {
      const text = item.files[filename];
      if (typeof text !== 'string') throw new WorkspaceError('NOT_FOUND', 'File not found.', 404);
      const first = text.indexOf(search);
      if (first < 0 || text.indexOf(search, first + 1) >= 0) throw new WorkspaceError('AMBIGUOUS_EDIT', 'Search text must occur exactly once. Include more surrounding text.');
      item.files[filename] = text.slice(0, first) + replacement + text.slice(first + search.length);
    });
  }

  history(id) {
    this.get(id);
    return this.db.prepare('SELECT revision, name, updated_at FROM history WHERE project_id=? ORDER BY revision DESC LIMIT 100').all(id);
  }

  restore(id, expectedRevision, revision) {
    return this.update(id, expectedRevision, item => {
      const row = this.db.prepare('SELECT name, files FROM history WHERE project_id=? AND revision=?').get(id, revision);
      if (!row) throw new WorkspaceError('NOT_FOUND', 'Saved revision not found.', 404);
      item.name = row.name; item.files = JSON.parse(row.files);
    });
  }

  export(id) {
    const item = this.get(id);
    const root = path.join(this.dataDir, 'exports');
    mkdirSync(root, { recursive: true });
    const destination = mkdtempSync(path.join(root, `${id}-r${item.revision}-`));
    for (const [filename, content] of Object.entries(item.files)) {
      fileName(filename);
      const target = path.join(destination, filename);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
    }
    for (const asset of this.assets(id)) { const target = path.join(destination, asset.name); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, asset.content, {flag:'wx'}); }
    return { project_id: id, revision: item.revision, directory: destination, files: Object.keys(item.files) };
  }
}
