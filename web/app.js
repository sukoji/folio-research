import { setupAssistant } from './assistant.js';
import { createEditor } from './editor.js';
import { renderPreview, validate } from './preview.js';
import { setupResearch } from './research.js';
import { setupManuscripts } from './manuscripts.js';
import { setupCompile } from './compile.js';

const $ = id => document.getElementById(id);
let active;
let currentFile = 'main.tex';
let dirty = false;
let generation = 0;
let saving;
let conflict = false;
let saveTimer;
let refreshing = false;
let switching = false;
let actionBusy = false;
const codeEditor = createEditor($('editor'), () => void save());

async function api(route, options = {}) {
  const response = await fetch(`/api${route}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || data.error || '요청 실패'), { status: response.status });
  return data;
}

function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 4500);
}

function status(message) { $('saveStatus').textContent = message; }
function draftKey() { return `folio-draft-${active.id}`; }
function rememberDraft() {
  try { localStorage.setItem(draftKey(), JSON.stringify({ name: active.name, files: active.files, revision: active.revision })); }
  catch { toast('브라우저 초안 보관 공간이 부족합니다. 파일을 다운로드하세요.'); }
}

function markDirty() {
  dirty = true; generation++; rememberDraft(); status(conflict ? '충돌 · 초안 보관됨' : '저장 중…');
  clearTimeout(saveTimer); if (!conflict) saveTimer = setTimeout(save, 600);
}

async function save() {
  if (saving) { const ok = await saving; return ok ? save() : false; }
  if (conflict) return false;
  if (!dirty || !active) return true;
  const sentGeneration = generation;
  const snapshot = { name: active.name, files: { ...active.files }, expected_revision: active.revision };
  const id = active.id;
  saving = (async () => {
    try {
      const updated = await api(`/projects/${id}`, { method: 'PUT', body: snapshot });
      active.revision = updated.revision; active.updated_at = updated.updated_at;
      dirty = generation !== sentGeneration;
      if (!dirty) { localStorage.removeItem(draftKey()); status(`저장됨 · r${updated.revision}`); }
      else { rememberDraft(); status('저장 중…'); }
      return true;
    } catch (error) {
      if (error.status === 409) {
        conflict = true; $('conflictBanner').classList.remove('hidden'); status('충돌 · 초안 보관됨');
      } else { status('저장 실패 · 초안 보관됨'); toast(error.message); }
      return false;
    }
  })();
  const ok = await saving; saving = null;
  if (ok && dirty) return save();
  return ok;
}

function updateMeta() {
  const outline=document.getElementById('outlineList');if(outline){outline.replaceChildren();for(const match of $('editor').value.matchAll(/\\(?:sub)*section\*?\{([^}]+)\}/g)){const b=document.createElement('button');b.textContent=match[1];b.onclick=()=>{codeEditor.dispatch({selection:{anchor:match.index},scrollIntoView:true});codeEditor.focus();};outline.append(b);}}
  const sources=document.getElementById('sourceLinks');if(sources){sources.replaceChildren();const seen=new Set();for(const m of $('editor').value.matchAll(/folio:\/\/papers\/([0-9a-f-]{36})\/pages\/(\d+)/g)){if(seen.has(m[0]))continue;seen.add(m[0]);const b=document.createElement('button');b.textContent=`인용 원문 · p.${m[2]}`;b.onclick=()=>safely(async()=>{if(await save())await openResearch({paperId:m[1],page:Number(m[2])});});sources.append(b);}}
  const editor = $('editor');
  const before = editor.value.slice(0, editor.selectionStart);
  $('cursorPosition').textContent = `Ln ${before.split('\n').length}, Col ${before.length - before.lastIndexOf('\n')}`;
  $('characterCount').textContent = `${editor.value.length.toLocaleString()}자`;
  $('lineNumbers').textContent = Array.from({ length: editor.value.split('\n').length }, (_, i) => i + 1).join('\n');
}

function preview() { if (active) renderPreview(active.files[currentFile] || '', currentFile); }

function renderFiles() {
  const list = $('fileList'); list.replaceChildren();
  const query = $('searchInput').value.trim().toLowerCase();
  for (const [name, content] of Object.entries(active.files)) {
    if (query && !name.toLowerCase().includes(query) && !content.toLowerCase().includes(query)) continue;
    const row = document.createElement('div'); row.className = 'file-row' + (name === currentFile ? ' active' : '');
    const open = document.createElement('button'); open.className = 'file-open';
    const glyph = document.createElement('span'); glyph.className = 'file-glyph'; glyph.textContent = name.endsWith('.tex') ? 'T' : '·';
    const label = document.createElement('span'); label.className = 'file-label'; label.textContent = name;
    open.append(glyph, label); open.onclick = () => { currentFile = name; renderEditor(); };
    const more = document.createElement('button'); more.className = 'file-more'; more.textContent = '⋯'; more.setAttribute('aria-label', `${name} 관리`);
    more.onclick = () => safely(() => fileActions(name));
    row.append(open, more); list.append(row);
  }
  for(const asset of active.assets || []) { const row=document.createElement('div');row.className='file-row asset-row';row.textContent='▧  '+asset.name;row.title=`${asset.bytes.toLocaleString()} bytes · 컴파일에 포함`;list.append(row); }
}

function renderEditor() {
  if (!Object.hasOwn(active.files, currentFile)) currentFile = Object.keys(active.files)[0];
  $('crumbProject').textContent = active.name;
  $('crumbFile').textContent = currentFile; $('tabFile').textContent = currentFile;
  $('editor').value = active.files[currentFile];
  $('editor').setSelectionRange(0, 0);
  renderFiles(); updateMeta(); preview();
}

async function refreshProjects() {
  const { projects } = await api('/projects');
  const select = $('projectSelect'); select.replaceChildren();
  for (const project of projects) {
    const option = document.createElement('option'); option.value = project.id; option.textContent = project.name; select.append(option);
  }
  if (active) select.value = active.id;
  return projects;
}

async function selectProject(id, recover = true) {
  if (active && !(await save())) { $('projectSelect').value = active.id; return; }
  active = await api(`/projects/${id}`); currentFile = Object.keys(active.files).find(f => f.endsWith('.tex')) || Object.keys(active.files)[0];
  localStorage.setItem('folio-active-project', id);
  dirty = false; conflict = false; generation++;
  $('conflictBanner').classList.add('hidden');
  status(`저장됨 · r${active.revision}`);
  const rawDraft = recover && localStorage.getItem(draftKey());
  if (rawDraft) {
    try {
      const draft = JSON.parse(rawDraft);
      if (draft.files && typeof draft.files === 'object' && !Array.isArray(draft.files) && Object.keys(draft.files).length && Object.values(draft.files).every(v => typeof v === 'string')) {
        const remoteRevision = active.revision;
        active.files = draft.files; active.name = draft.name; active.revision = draft.revision;
        dirty = true; conflict = remoteRevision !== draft.revision;
        status(conflict ? '초안 복원 · 충돌 확인 필요' : '저장 못한 초안 복원됨');
        $('conflictBanner').classList.toggle('hidden', !conflict);
        if (!conflict) saveTimer = setTimeout(save, 600);
      }
    } catch { toast('저장된 초안을 읽지 못했습니다. 서버 문서를 열었습니다.'); }
  }
  await refreshProjects(); renderEditor();
}

function modal(title, description, initial = '') {
  return new Promise(resolve => {
    $('modalTitle').textContent = title; $('modalDescription').textContent = description; $('modalInput').value = initial;
    const dialog = $('modal'); dialog.returnValue = 'cancel'; dialog.showModal(); $('modalInput').focus(); $('modalInput').select();
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm' ? $('modalInput').value.trim() : null), { once: true });
  });
}

async function fileActions(name) {
  const target = await modal('파일 관리', `${name}\n이름을 바꾸려면 새 파일명, 삭제하려면 DELETE를 입력하세요. 이전 내용은 수정 기록에 보관됩니다.`, name);
  if (!target || target === name) return;
  if (!(await save())) return;
  const files = { ...active.files };
  if (target === 'DELETE') {
    if (Object.keys(files).length < 2) return toast('마지막 파일은 삭제할 수 없습니다.');
    delete files[name];
  } else {
    if (Object.keys(files).some(n => n.toLowerCase() === target.toLowerCase())) return toast('같은 이름의 파일이 있습니다.');
    files[target] = files[name]; delete files[name];
  }
  await mutateFiles(files); currentFile = target === 'DELETE' ? Object.keys(active.files)[0] : target; renderEditor();
}

async function mutateFiles(files) {
  // Keep current memory unchanged on validation failure, e.g. unsafe filenames.
  generation++;
  const updated = await api(`/projects/${active.id}`, { method: 'PUT', body: { name: active.name, files, expected_revision: active.revision } });
  active = updated; status(`저장됨 · r${active.revision}`);
}

function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadProject(suffix = '') {
  download(`${active.name.replace(/[^\w가-힣-]/g, '_')}${suffix}.json`, JSON.stringify({ name: active.name, files: active.files }, null, 2), 'application/json');
}

async function safely(action) {
  if (actionBusy) return;
  actionBusy = true; switching = true; generation++;
  const panels = [document.querySelector('.sidebar'), document.querySelector('.editor-pane'), document.querySelector('.topbar')];
  panels.forEach(panel => { panel.inert = true; });
  try { await action(); } catch (error) { toast(error.message); }
  finally { panels.forEach(panel => { panel.inert = false; }); actionBusy = false; switching = false; generation++; }
}

$('editor').addEventListener('input', () => { active.files[currentFile] = $('editor').value; updateMeta(); markDirty(); preview(); });
$('editor').addEventListener('scroll', () => { $('lineNumbers').scrollTop = $('editor').scrollTop; });
$('editor').addEventListener('click', updateMeta); $('editor').addEventListener('keyup', updateMeta);
$('editor').addEventListener('keydown', event => {
  if (event.key === 'Tab') { event.preventDefault(); const e = event.target; e.setRangeText('  ', e.selectionStart, e.selectionEnd, 'end'); e.dispatchEvent(new Event('input')); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
});
$('newProject').onclick = () => safely(async () => {
  const name = await modal('새 프로젝트', 'Codex와 Claude Code가 함께 사용할 연구 프로젝트 이름입니다.', '새 연구 프로젝트');
  if (!name || !(await save())) return;
  const created = await api('/projects', { method: 'POST', body: { name } }); await selectProject(created.id);
});
$('projectSelect').onchange = event => safely(() => selectProject(event.target.value));
$('newFile').onclick = () => safely(async () => {
  const filename = await modal('새 파일', '예: sections/methods.tex 또는 references.bib', 'appendix.tex');
  if (!filename || !(await save())) return;
  if (Object.hasOwn(active.files, filename)) return toast('같은 이름의 파일이 있습니다.');
  await mutateFiles({ ...active.files, [filename]: '' }); currentFile = filename; renderEditor();
});
$('toggleSearch').onclick = () => { $('searchBox').classList.toggle('hidden'); if (!$('searchBox').classList.contains('hidden')) $('searchInput').focus(); };
$('searchInput').oninput = renderFiles;
$('importButton').onclick = () => $('importInput').click();
$('importInput').onchange = event => safely(async () => {
  if (!(await save())) return;
  for (const file of event.target.files) {
    if (/\.zip$/i.test(file.name)) {
      if(file.size>20*1024*1024)throw new Error('ZIP은 20 MiB 이하여야 합니다.');
      const bytes=new Uint8Array(await file.arrayBuffer()); let raw=''; for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
      const result=await api('/import',{method:'POST',body:{name:file.name.replace(/\.zip$/i,''),zip_base64:btoa(raw)}});
      await selectProject(result.project.id); if(result.skipped.length)await modal('가져오기 결과', '지원하지 않아 제외한 파일: '+result.skipped.join(', ')); continue;
    }
    if (file.size > 2 * 1024 * 1024) throw new Error('가져올 파일은 2 MiB 이하여야 합니다.');
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      const imported = JSON.parse(text);
      const created = await api('/projects', { method: 'POST', body: { name: imported.name, files: imported.files } });
      await selectProject(created.id);
    } else {
      let name = file.name, n = 2;
      while (Object.keys(active.files).some(f => f.toLowerCase() === name.toLowerCase())) name = file.name.replace(/(\.[^.]+)$/, ` (${n++})$1`);
      await mutateFiles({ ...active.files, [name]: text }); currentFile = name;
    }
  }
  event.target.value = ''; renderEditor(); toast('가져오기를 마쳤습니다.');
});
$('exportProject').onclick = () => safely(async()=>{if(await save()){const a=document.createElement('a');a.href=`/api/projects/${active.id}/archive`;a.download='folio-project.zip';a.click();}});
$('downloadFile').onclick = () => download(currentFile.split('/').pop(), active.files[currentFile]);
$('downloadDraft').onclick = () => downloadProject('-draft');
$('loadRemote').onclick = () => safely(async () => {
  // Download the conflicting draft before switching, so it stays recoverable
  // even when the browser recovery slot is later used by another edit.
  downloadProject('-conflict-draft');
  const remote = await api(`/projects/${active.id}`);
  localStorage.removeItem(draftKey()); active = remote; conflict = false; dirty = false; generation++;
  $('conflictBanner').classList.add('hidden'); status(`저장됨 · r${active.revision}`); renderEditor();
});
$('printPdf').onclick = () => window.print(); $('renderButton').onclick = preview;
$('checkSource').onclick = () => { const errors = validate(active.files[currentFile]); $('helperMessage').textContent = errors.length ? errors.join(' ') : '기본 문서 구조에서 오류를 찾지 못했습니다. 실제 TeX 컴파일 검사는 아닙니다.'; preview(); };
const snippets = { section: '\\section{New section}\n', equation: '\\begin{equation}\n  a^2 + b^2 = c^2\n\\end{equation}\n', itemize: '\\begin{itemize}\n  \\item First item\n\\end{itemize}\n' };
document.querySelectorAll('[data-insert]').forEach(button => button.onclick = () => {
  const editor = $('editor'); editor.setRangeText(snippets[button.dataset.insert], editor.selectionStart, editor.selectionEnd, 'end'); editor.dispatchEvent(new Event('input')); editor.focus();
});
$('mobileMenu').onclick = () => $('sidebar').classList.toggle('open');
$('historyButton').onclick = () => safely(async () => {
  if (!(await save())) return;
  const { revisions } = await api(`/projects/${active.id}/history`);
  const choice = await modal('수정 기록 복원', '복원할 버전 번호를 입력하세요. 현재 내용도 기록에 남습니다.\n' + revisions.slice(0, 15).map(r => `r${r.revision} · ${new Date(r.updated_at).toLocaleString()}`).join('\n'), String(active.revision));
  if (!choice || !Number.isSafeInteger(Number(choice))) return;
  active = await api(`/projects/${active.id}/restore`, { method: 'POST', body: { expected_revision: active.revision, restore_revision: Number(choice) } }); renderEditor(); status(`복원됨 · r${active.revision}`);
});
$('connectionButton').onclick = () => safely(async () => {
  const info = await api('/info');
  $('codexConfig').textContent = `[mcp_servers.folio]\ncommand = ${JSON.stringify(info.stdio.command)}\nargs = ${JSON.stringify(info.stdio.args)}\n`;
  $('claudeConfig').textContent = JSON.stringify({ mcpServers: { folio: { type: 'stdio', ...info.stdio } } }, null, 2);
  $('httpInfo').textContent = `이 편집기가 실행 중일 때 HTTP 연결도 가능: ${info.mcp_url}`;
  $('connectionModal').showModal();
});
window.addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } });

async function refresh() {
  if (refreshing || switching || saving || dirty || conflict || !active) return;
  refreshing = true;
  const id = active.id, observedGeneration = generation;
  try {
    const remote = await api(`/projects/${id}`);
    if (active.id !== id || generation !== observedGeneration || dirty || saving || conflict) return;
    if (remote.revision !== active.revision) { active = remote; renderEditor(); status(`에이전트 변경 반영 · r${active.revision}`); }
    await refreshProjects();
  } catch { status('서버 연결 끊김'); }
  finally { refreshing = false; }
}

async function initialize() {
  $('editor').disabled = true;
  let projects = await refreshProjects();
  if (!projects.length) projects = [await api('/projects', { method: 'POST', body: { name: '새 연구 프로젝트' } })];
  const selected = localStorage.getItem('folio-active-project');
  await selectProject(projects.find(p => p.id === selected)?.id || projects[0].id);
  $('editor').disabled = false;
  document.querySelector('.local-note').textContent = '● 로컬 DB 저장 · MCP 연결 가능';
  setInterval(refresh, 1500);
}
const openResearch = setupResearch({ api, toast, ask:options=>openAssistant(options), cite: async (paperId, page, noteId) => {
  if(actionBusy)throw new Error('현재 원고 작업을 마친 뒤 인용하세요.');
  actionBusy=true;switching = true; generation++;
  const panels=[document.querySelector('.sidebar'),document.querySelector('.editor-pane'),document.querySelector('.workspace>.topbar')];
  panels.forEach(panel=>{panel.inert=true;});
  try {
    if (!(await save())) throw new Error('원고 저장 충돌을 먼저 해결하세요.');
    const filename = currentFile.endsWith('.tex') ? currentFile : Object.keys(active.files).find(name => name.endsWith('.tex'));
    if (!filename) throw new Error('프로젝트에 .tex 원고 파일이 필요합니다.');
    const position=$('editor').selectionStart,scroll=codeEditor.scrollDOM.scrollTop,sameFile=currentFile===filename;
    active = await api(`/papers/${paperId}/cite`, { method: 'POST', body: { project_id: active.id, expected_revision: active.revision, filename, page, note_id: noteId } });
    currentFile = filename; renderEditor(); status(`인용 저장됨 · r${active.revision}`);
    if(sameFile){const cursor=Math.min(position,$('editor').value.length);$('editor').setSelectionRange(cursor,cursor);codeEditor.scrollDOM.scrollTop=scroll;}
  } finally {panels.forEach(panel=>{panel.inert=false;});actionBusy=false; switching = false; generation++; }
} });
const compileButton=document.createElement('button');compileButton.className='toolbar-button primary';compileButton.textContent='PDF 컴파일';compileButton.id='compilePdf';
compileButton.onclick=setupCompile({api,save,getProject:()=>active,toast});$('printPdf').before(compileButton);$('printPdf').textContent='간이 인쇄';$('printPdf').classList.remove('primary');

const outline=document.createElement('details');outline.className='editor-outline';outline.innerHTML='<summary>문서 목차 · 인용 원문</summary><div id="outlineList"></div><div id="sourceLinks"></div>';document.querySelector('.library-panel').before(outline);
if(window.folioDesktop){const b=document.createElement('button');b.className='side-action';b.textContent='브라우저에서 같은 작업 공간 열기';b.onclick=()=>window.folioDesktop.openWeb();document.querySelector('.sidebar-bottom').append(b);}
const openAssistant=setupAssistant({toast,getContext:()=>{const e=$('editor');return e.value.slice(e.selectionStart,e.selectionEnd)||e.value;}});
setupManuscripts({api,toast});
const workspaceTools=document.createElement('details');workspaceTools.className='workspace-tools';workspaceTools.innerHTML='<summary>연결 · 기록 · 내보내기</summary>';
for(const id of ['connectionButton','historyButton','importButton','exportProject'])workspaceTools.append($(id));
document.querySelector('.local-note').before(workspaceTools);
initialize().catch(error => { status('연결 실패'); toast(error.message); });
