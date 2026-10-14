import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkspaceError, fileName } from './store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export class Compiler {
  constructor(store) {
    this.store = store; this.busy = false;
    const bundled = path.join(root, 'data/tools/tectonic', process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
    const runtime = path.join(root, 'runtime', process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
    this.command = process.env.FOLIO_TECTONIC_PATH || (existsSync(runtime) ? runtime : existsSync(bundled) ? bundled : 'tectonic');
    store.db.exec('CREATE TABLE IF NOT EXISTS compilations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, revision INTEGER NOT NULL, filename TEXT NOT NULL, status TEXT NOT NULL, log TEXT NOT NULL, created_at TEXT NOT NULL)');
  }
  async compile(projectId, expectedRevision, filename = 'main.tex') {
    fileName(filename);
    if (!filename.endsWith('.tex')) throw new WorkspaceError('INVALID_FILENAME', '.tex 진입 파일을 선택하세요.');
    const project = this.store.get(projectId);
    if (project.revision !== expectedRevision) throw new WorkspaceError('REVISION_CONFLICT', '원고가 변경됐습니다. 다시 읽고 컴파일하세요.',409);
    if (!Object.hasOwn(project.files, filename)) throw new WorkspaceError('NOT_FOUND', '진입 파일을 찾지 못했습니다.',404);
    if (this.busy) throw new WorkspaceError('COMPILER_BUSY', '다른 컴파일이 진행 중입니다.',409);
    this.busy = true;
    const id = randomUUID(), dir = path.join(this.store.dataDir,'builds',id), out = path.join(dir,'output');
    try {
      mkdirSync(out,{recursive:true});
      for (const [name, content] of Object.entries(project.files)) {
        fileName(name); const target = path.join(dir,name); mkdirSync(path.dirname(target),{recursive:true}); writeFileSync(target,content,'utf8');
      }
      for (const asset of this.store.assets(projectId)) { const target = path.join(dir,asset.name); mkdirSync(path.dirname(target),{recursive:true}); writeFileSync(target,asset.content); }
      const result = await new Promise((resolve,reject) => {
        const child = spawn(this.command,['-X','compile','--untrusted','--keep-logs','--outdir',out,`./${filename}`],{cwd:dir,windowsHide:true,env:{...process.env,TECTONIC_UNTRUSTED_MODE:'1'},stdio:['ignore','pipe','pipe']});
        let log = '', timedOut = false;
        const capture = data => { log = (log + data.toString()).slice(-60000); };
        child.stdout.on('data',capture); child.stderr.on('data',capture);
        const timer = setTimeout(() => { timedOut = true; child.kill(); },180000);
        child.once('error',error => { clearTimeout(timer); reject(new WorkspaceError('COMPILER_UNAVAILABLE', error.code === 'ENOENT' ? 'Tectonic이 없습니다. npm run setup:tex를 실행하세요.' : error.message,503)); });
        child.once('close',code => { clearTimeout(timer); resolve({ code, log, timedOut }); });
      });
      const output = path.join(out,path.basename(filename,'.tex')+'.pdf');
      const success = result.code === 0 && existsSync(output) && readFileSync(output).subarray(0,5).toString() === '%PDF-';
      const record = { id, project_id:projectId, revision:project.revision, filename, status:success?'success':'failed', log:result.timedOut?'컴파일 제한 시간(180초)을 초과했습니다.\n'+result.log:result.log, created_at:new Date().toISOString() };
      this.store.db.prepare('INSERT INTO compilations VALUES(?,?,?,?,?,?,?)').run(...Object.values(record));
      return {...record, pdf_url:success?`/api/builds/${id}/pdf`:null, pdf_path:success?output:null};
    } finally { this.busy = false; }
  }
  pdf(id) {
    const row = this.store.db.prepare("SELECT * FROM compilations WHERE id=? AND status='success'").get(id);
    if (!row || !/^[0-9a-f-]{36}$/.test(id)) throw new WorkspaceError('NOT_FOUND','컴파일된 PDF를 찾지 못했습니다.',404);
    return path.join(this.store.dataDir,'builds',id,'output',path.basename(row.filename,'.tex')+'.pdf');
  }
}
