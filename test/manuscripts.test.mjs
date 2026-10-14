import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { References } from '../src/references.mjs';
import { HwpxDocuments,writePackage,readPackage } from '../src/hwpx.mjs';

test('reference import, CSL styles, revision protection, merge and persistent history',t=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'folio-ref-')),store=new Store(dir),refs=new References(store);t.after(()=>store.close());
  const a=refs.import('TY  - JOUR\nTI  - Evidence study\nAU  - Kim, Min\nPY  - 2024\nDO  - 10.1234/test\nER  -\n','ris').items[0];
  assert.equal(a.data.author[0].family,'Kim');
  const b=refs.import('@article{Kim2024,title={Evidence study},author={Kim, Min},year={2024},doi={https://doi.org/10.1234/TEST}}','bibtex').items[0];
  assert.equal(refs.duplicates().length,1);
  assert.match(refs.format([a.id],'apa').citation,/Kim, 2024/);
  assert.doesNotMatch(refs.format([a.id],'vancouver').citation,/Kim/);
  const bib=refs.export([a.id],'bibtex');assert.match(bib,/Evidence study/);
  assert.equal(refs.import(refs.export([a.id],'ris'),'ris').items[0].data.title,a.data.title);
  const updated=refs.save(a.id,1,{...a.data,title:'Corrected'},'Thesis');
  assert.throws(()=>refs.save(a.id,1,a.data),{code:'REVISION_CONFLICT'});
  assert.throws(()=>refs.merge(a.id,1,b.id,1,a.data),{code:'REVISION_CONFLICT'});
  assert.equal(refs.get(b.id).revision,1);
  refs.merge(a.id,updated.revision,b.id,1,updated.data);
  assert.throws(()=>refs.get(b.id),{code:'NOT_FOUND'});
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM reference_history WHERE id=?').get(b.id).n,2);
  const count=refs.list().length;
  assert.throws(()=>refs.import('[{"title":"valid"},{}]','csl'));
  assert.equal(refs.list().length,count);
  const second=new Store(dir);try{assert.equal(new References(second).get(a.id).collection,'Thesis');}finally{second.close();}
});

export async function hwpxFixture(){return writePackage(new Map([
  ['mimetype',Buffer.from('application/hwp+zip')],
  ['Contents/content.hpf',Buffer.from('<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="s1" href="section1.xml"/><item id="s0" href="section0.xml"/></manifest><spine><itemref idref="s1"/><itemref idref="s0"/></spine></package>')],
  ['Contents/header.xml',Buffer.from('<head>style-preserved</head>')],
  ['Contents/section1.xml',Buffer.from('<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run charPrIDRef="4"><hp:t>First</hp:t></hp:run><hp:run charPrIDRef="7"><hp:t>Bold</hp:t></hp:run><hp:linesegarray/></hp:p></hs:sec>')],
  ['Contents/section0.xml',Buffer.from('<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:tbl><hp:tc><hp:p><hp:run><hp:t>Cell</hp:t></hp:run></hp:p></hp:tc></hp:tbl></hs:sec>')],
  ['BinData/image1.png',Buffer.from([1,2,3,4])]
]));}
test('HWPX spine order, mixed style and binary preservation, XML escaping and concurrent revision',async t=>{
  const store=new Store(mkdtempSync(path.join(os.tmpdir(),'folio-hwpx-')));t.after(()=>store.close());
  const hw=new HwpxDocuments(store),original=await hwpxFixture();const imported=await hw.import(original,'Test');
  assert.deepEqual(imported.paragraphs.map(p=>p.text),['First','Bold','Cell']);assert.ok(imported.paragraphs[2].in_table);
  const updated=await hw.save(imported.id,1,[{id:imported.paragraphs[0].id,text:'한글 & <text>'}]);
  assert.equal(updated.revision,2);assert.equal(updated.paragraphs[0].text,'한글 & <text>');assert.equal(updated.paragraphs[1].char_style,'7');
  const before=await readPackage(original),after=await readPackage(Buffer.from(hw.row(imported.id).bytes));
  for(const name of ['Contents/header.xml','Contents/section0.xml','BinData/image1.png'])assert.deepEqual(after.get(name),before.get(name));
  assert.doesNotMatch(after.get('Contents/section1.xml').toString(),/linesegarray/);
  await assert.rejects(hw.save(imported.id,1,[]),{code:'REVISION_CONFLICT'});
  await assert.rejects(hw.save(imported.id,2,[{id:'bad:0',text:'x'}]),{code:'INVALID_HWPX'});
  assert.equal(hw.row(imported.id).revision,2);
  assert.deepEqual(Buffer.from(store.db.prepare('SELECT bytes FROM hwpx_history WHERE id=? AND revision=1').get(imported.id).bytes),original);
  const hostile=new Map(before);hostile.set('Contents/section1.xml',Buffer.from('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><x/>'));
  await assert.rejects(hw.import(await writePackage(hostile),'bad'),{code:'INVALID_HWPX'});
});
