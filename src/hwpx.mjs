import yauzl from 'yauzl';
import yazl from 'yazl';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { randomUUID } from 'node:crypto';
import { WorkspaceError } from './store.mjs';

const HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
const invalid = message => new WorkspaceError('INVALID_HWPX',message);
function xml(bytes) {
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw invalid('DTD 또는 외부 엔티티를 포함한 문서는 지원하지 않습니다.');
  return new DOMParser({onError:()=>{throw invalid('XML 형식이 올바르지 않습니다.');}}).parseFromString(text,'application/xml');
}
export async function readPackage(bytes) {
  if(!Buffer.isBuffer(bytes)||bytes.length>20*1024*1024)throw invalid('HWPX 파일은 20 MiB 이하여야 합니다.');
  const entries=new Map();let size=0,count=0;
  await new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(err,zip)=>{
    if(err)return reject(invalid('HWPX ZIP 파일이 아닙니다. 바이너리 HWP는 한글에서 HWPX로 저장해 주세요.'));
    const fail=error=>{zip.close();reject(error instanceof WorkspaceError?error:invalid('손상된 HWPX ZIP입니다.'));};
    zip.on('error',fail);zip.on('end',resolve);
    zip.on('entry',entry=>{
      const name=entry.fileName;
      if(++count>500||(size+=entry.uncompressedSize)>50*1024*1024)return fail(invalid('문서 압축 해제 한도를 초과했습니다.'));
      if(name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.')||((entry.externalFileAttributes>>>16)&0xf000)===0xa000)return fail(invalid('안전하지 않은 ZIP 경로입니다.'));
      if(name.endsWith('/'))return zip.readEntry();
      if([...entries.keys()].some(k=>k.toLowerCase()===name.toLowerCase()))return fail(invalid('중복된 ZIP 항목입니다.'));
      zip.openReadStream(entry,(error,stream)=>{
        if(error)return fail(error);const chunks=[];let received=0;
        stream.on('data',chunk=>{received+=chunk.length;if(received>entry.uncompressedSize)stream.destroy(invalid('ZIP 크기가 일치하지 않습니다.'));else chunks.push(chunk);});
        stream.on('error',fail);stream.on('end',()=>{entries.set(name,Buffer.concat(chunks));zip.readEntry();});
      });
    });zip.readEntry();
  }));
  if(entries.get('mimetype')?.toString().trim()!=='application/hwp+zip'||!entries.has('Contents/content.hpf'))throw invalid('HWPX 패키지 정보를 찾지 못했습니다.');
  for(const [name,bytes]of entries)if(/META-INF\//i.test(name)&&/encrypt|signature/i.test(bytes.toString()))throw invalid('암호화 또는 서명 문서는 편집할 수 없습니다.');
  return entries;
}
function sections(entries) {
  const manifest=xml(entries.get('Contents/content.hpf'));
  const items=new Map(Array.from(manifest.getElementsByTagNameNS('*','item')).map(n=>[n.getAttribute('id'),n.getAttribute('href')]));
  const names=Array.from(manifest.getElementsByTagNameNS('*','itemref')).map(n=>items.get(n.getAttribute('idref'))).filter(n=>n&&/(?:^|\/)section\d+\.xml$/.test(n)).map(n=>n.startsWith('Contents/')?n:'Contents/'+n);
  if(!names.length||new Set(names).size!==names.length||names.some(n=>!entries.has(n)))throw invalid('문서 본문의 읽기 순서가 올바르지 않습니다.');
  return names;
}
function editableNodes(doc) {
  // Text containing inline controls is preserved as an indivisible original object.
  return Array.from(doc.getElementsByTagNameNS(HP,'t')).filter(n=>Array.from(n.childNodes).every(c=>c.nodeType===3));
}
export function describePackage(entries) {
  const paragraphs=[];
  for(const name of sections(entries)) {
    const doc=xml(entries.get(name)); const nodes=editableNodes(doc);
    for(const [index,n]of nodes.entries()) {
      let parent=n.parentNode, inTable=false;
      while(parent){if(parent.localName==='tc')inTable=true;parent=parent.parentNode;}
      paragraphs.push({id:`${name}:${index}`,text:n.textContent,char_style:n.parentNode.getAttribute?.('charPrIDRef')||'',in_table:inTable});
    }
  }
  return {paragraphs,notice:'본문 텍스트 편집입니다. 표·수식·그림과 서식은 원본 구조를 보존하며, 화면의 줄바꿈·쪽 배치는 한글과 다를 수 있습니다.'};
}
export async function editPackage(bytes,changes) {
  const entries=await readPackage(bytes),names=sections(entries),pending=new Map();
  if(!Array.isArray(changes)||changes.length>10000)throw invalid('수정 목록이 올바르지 않습니다.');
  const seen=new Set();
  for(const change of changes){
    if(!change||typeof change.id!=='string'||typeof change.text!=='string'||change.text.length>100000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(change.text)||seen.has(change.id))throw invalid('수정 텍스트가 올바르지 않습니다.');
    seen.add(change.id);const cut=change.id.lastIndexOf(':'),name=change.id.slice(0,cut),index=Number(change.id.slice(cut+1));
    if(!names.includes(name)||!Number.isSafeInteger(index)||index<0)throw invalid('본문 위치가 올바르지 않습니다.');
    if(!pending.has(name))pending.set(name,xml(entries.get(name)));
    const n=editableNodes(pending.get(name))[index];if(!n)throw invalid('본문 위치가 사라졌습니다.');
    n.textContent=change.text;
  }
  for(const [name,doc]of pending){
    // Cached line positions are invalid after text edits; the word processor lays out again.
    for(const n of Array.from(doc.getElementsByTagNameNS(HP,'linesegarray')))n.parentNode.removeChild(n);
    entries.set(name,Buffer.from(new XMLSerializer().serializeToString(doc)));
  }
  // Update text preview. Do not retain a misleading image preview after an edit.
  if(changes.length){
    entries.set('Preview/PrvText.txt',Buffer.from(describePackage(entries).paragraphs.map(p=>p.text).join('\r\n')));
    entries.delete('Preview/PrvImage.png');
    const manifest=xml(entries.get('Contents/content.hpf'));let changed=false;
    for(const n of Array.from(manifest.getElementsByTagNameNS('*','item')))if(/(?:^|\/)PrvImage\.png$/.test(n.getAttribute('href'))){
      const id=n.getAttribute('id');n.parentNode.removeChild(n);changed=true;
      for(const ref of Array.from(manifest.getElementsByTagNameNS('*','itemref')))if(ref.getAttribute('idref')===id)ref.parentNode.removeChild(ref);
    }
    if(changed)entries.set('Contents/content.hpf',Buffer.from(new XMLSerializer().serializeToString(manifest)));
  }
  return writePackage(entries);
}
export function writePackage(entries) {
  return new Promise((resolve,reject)=>{const zip=new yazl.ZipFile(),chunks=[];
    zip.outputStream.on('data',c=>chunks.push(c));zip.outputStream.on('error',reject);zip.outputStream.on('end',()=>resolve(Buffer.concat(chunks)));
    zip.addBuffer(entries.get('mimetype'),'mimetype',{compress:false});
    for(const [name,bytes]of entries)if(name!=='mimetype')zip.addBuffer(bytes,name);
    zip.end();
  });
}
export class HwpxDocuments {
  constructor(store){this.db=store.db;this.db.exec('CREATE TABLE IF NOT EXISTS hwpx_documents(id TEXT PRIMARY KEY,name TEXT NOT NULL,revision INTEGER NOT NULL,bytes BLOB NOT NULL); CREATE TABLE IF NOT EXISTS hwpx_history(id TEXT NOT NULL,revision INTEGER NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(id,revision));');}
  list(){return this.db.prepare('SELECT id,name,revision FROM hwpx_documents ORDER BY rowid DESC').all();}
  row(id){const r=this.db.prepare('SELECT * FROM hwpx_documents WHERE id=?').get(id);if(!r)throw new WorkspaceError('NOT_FOUND','한글 원고가 없습니다.',404);return r;}
  async get(id){const {bytes,...row}=this.row(id);return {...row,...describePackage(await readPackage(Buffer.from(bytes)))};}
  async import(bytes,name){if(typeof name!=='string'||!name.trim()||name.length>120)throw invalid('문서 이름은 1–120자여야 합니다.');describePackage(await readPackage(bytes));const id=randomUUID();this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO hwpx_documents VALUES(?,?,1,?)').run(id,name,bytes);this.db.prepare('INSERT INTO hwpx_history VALUES(?,1,?)').run(id,bytes);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}return this.get(id);}
  async save(id,revision,changes){const row=this.row(id);if(row.revision!==revision)throw new WorkspaceError('REVISION_CONFLICT','문서가 변경됐습니다.',409);const bytes=await editPackage(Buffer.from(row.bytes),changes);this.db.exec('BEGIN IMMEDIATE');try{const r=this.db.prepare('UPDATE hwpx_documents SET revision=revision+1,bytes=? WHERE id=? AND revision=?').run(bytes,id,revision);if(!r.changes)throw new WorkspaceError('REVISION_CONFLICT','문서가 변경됐습니다.',409);this.db.prepare('INSERT INTO hwpx_history VALUES(?,?,?)').run(id,revision+1,bytes);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}return this.get(id);}
}
