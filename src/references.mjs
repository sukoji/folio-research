import { randomUUID } from 'node:crypto';
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-ris';
import '@citation-js/plugin-csl';
import { WorkspaceError } from './store.mjs';

const fail = message => { throw new WorkspaceError('INVALID_REFERENCE', message); };
const doi = value => String(value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
function validate(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.title !== 'string' || !item.title.trim()) fail('참고문헌 제목이 필요합니다.');
  if (JSON.stringify(item).length > 64000) fail('서지정보가 너무 큽니다.');
  if (item.author && (!Array.isArray(item.author) || item.author.some(a => !a || typeof a !== 'object' || !['family','literal'].some(k => typeof a[k] === 'string')))) fail('저자는 CSL 이름 배열이어야 합니다.');
  return { ...item, title: item.title.trim(), type: item.type || 'article-journal' };
}
export class References {
  constructor(store) {
    this.db = store.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS reference_items(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL, collection TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS reference_history(id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, collection TEXT NOT NULL, archived INTEGER NOT NULL, PRIMARY KEY(id,revision));`);
  }
  list() { return this.db.prepare('SELECT * FROM reference_items WHERE archived=0 ORDER BY rowid DESC').all().map(r => ({...r, data:JSON.parse(r.data)})); }
  get(id) {
    const r = this.db.prepare('SELECT * FROM reference_items WHERE id=? AND archived=0').get(id);
    if (!r) throw new WorkspaceError('NOT_FOUND','참고문헌이 없습니다.',404);
    return {...r,data:JSON.parse(r.data)};
  }
  save(id, expected, data, collection = '') {
    if(id&&(!Number.isSafeInteger(expected)||expected<1))fail('현재 수정 버전이 필요합니다.');
    data = validate(data);
    if (typeof collection !== 'string' || collection.length > 120) fail('컬렉션 이름은 120자 이하여야 합니다.');
    const creating = !id; id ||= randomUUID(); data.id = id;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (creating) this.db.prepare('INSERT INTO reference_items VALUES(?,1,?,?,0)').run(id,JSON.stringify(data),collection);
      else {
        this.get(id);
        const changed = this.db.prepare('UPDATE reference_items SET data=?, collection=?, revision=revision+1 WHERE id=? AND revision=? AND archived=0').run(JSON.stringify(data),collection,id,expected);
        if (!changed.changes) throw new WorkspaceError('REVISION_CONFLICT','서지정보가 변경됐습니다. 다시 읽은 뒤 수정하세요.',409);
      }
      this.snapshot(id); this.db.exec('COMMIT'); return this.get(id);
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  snapshot(id) { this.db.prepare('INSERT INTO reference_history SELECT id,revision,data,collection,archived FROM reference_items WHERE id=?').run(id); }
  import(text, format, collection = '') {
    if (typeof text !== 'string' || Buffer.byteLength(text) > 2*1024*1024) fail('가져오기 파일은 2 MiB 이하여야 합니다.');
    if (!['bibtex','ris','csl'].includes(format)) fail('BibTeX, RIS, CSL JSON만 지원합니다.');
    let items;
    try { items = format === 'csl' ? JSON.parse(text) : new Cite(text, {forceType:format==='ris'?'@ris/file':'@bibtex/text'}).data; }
    catch { fail('참고문헌 파일을 해석하지 못했습니다.'); }
    if (!Array.isArray(items) || !items.length || items.length > 1000) fail('1–1000개 참고문헌을 가져올 수 있습니다.');
    items = items.map(validate);
    if (typeof collection !== 'string' || collection.length > 120) fail('컬렉션 이름이 너무 깁니다.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const ids = items.map(item => {
        const id = randomUUID();
        this.db.prepare('INSERT INTO reference_items VALUES(?,1,?,?,0)').run(id,JSON.stringify({...item,id}),collection);
        this.snapshot(id); return id;
      });
      this.db.exec('COMMIT'); return {items:ids.map(id=>this.get(id))};
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  select(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length>1000 || new Set(ids).size!==ids.length) fail('서로 다른 참고문헌을 1–1000개 선택하세요.');
    return ids.map(id=>this.get(id).data);
  }
  export(ids, format) {
    const items=this.select(ids);
    if(format==='csl') return JSON.stringify(items,null,2);
    if(!['bibtex','ris'].includes(format)) fail('지원하지 않는 내보내기 형식입니다.');
    return new Cite(items).format(format);
  }
  format(ids, style = 'apa') {
    if(!['apa','vancouver','harvard1'].includes(style)) fail('지원하지 않는 인용 양식입니다.');
    const cite=new Cite(this.select(ids));
    return {style,citation:cite.format('citation',{template:style,format:'text',lang:'en-US'}),bibliography:cite.format('bibliography',{template:style,format:'text',lang:'en-US'})};
  }
  duplicates() {
    const groups=new Map();
    for(const item of this.list()) {
      const key=doi(item.data.DOI); if(!key)continue;
      if(!groups.has(key))groups.set(key,[]); groups.get(key).push(item);
    }
    return [...groups].filter(([,items])=>items.length>1).map(([doi,items])=>({doi,items}));
  }
  merge(keepId, expected, otherId, otherExpected, data) {
    if(keepId===otherId)fail('서로 다른 참고문헌을 선택하세요.');
    data=validate(data); data.id=keepId;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const keep=this.get(keepId), other=this.get(otherId);
      if(keep.revision!==expected || other.revision!==otherExpected)throw new WorkspaceError('REVISION_CONFLICT','병합 대상이 변경됐습니다.',409);
      this.db.prepare('UPDATE reference_items SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify(data),keepId);
      this.db.prepare('UPDATE reference_items SET archived=1,revision=revision+1 WHERE id=?').run(otherId);
      this.snapshot(keepId);this.snapshot(otherId);this.db.exec('COMMIT');return this.get(keepId);
    } catch(e){this.db.exec('ROLLBACK');throw e;}
  }
}
