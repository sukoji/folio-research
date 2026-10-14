import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { Library } from '../src/library.mjs';
import { Discovery } from '../src/discovery.mjs';
import { Compiler } from '../src/compiler.mjs';
import { scannedPdfFixture } from './pdf-fixture.mjs';

test('scanned PDF automatically gains searchable local OCR without replacing original bytes', {timeout:120000}, async t => {
  const store = new Store(mkdtempSync(path.join(os.tmpdir(),'folio-ocr-'))), library = new Library(store);
  t.after(async () => { await library.close(); store.close(); });
  const bytes = await scannedPdfFixture(), paper = await library.importPdf(bytes,{title:'Scanned research'});
  assert.equal(paper.ocr.length,1);
  await library.runOcr();
  const page = library.page(paper.id,1);
  assert.equal(page.ocr.status,'done',page.ocr.error);
  assert.equal(page.text_source,'ocr'); assert.match(page.text,/RESEARCH EVIDENCE/i);
  assert.equal(library.search(paper.id,'scanned')[0].page,1);
  assert.deepEqual(library.pdf(paper.id),bytes);
  const selected = page.text.trim().split('\n')[0];
  assert.equal(library.addNote(paper.id,1,selected,'Verified OCR passage').quote,selected);
});

test('discovery sends bounded queries to fixed provider, excludes seed and saves references', async t => {
  const store = new Store(mkdtempSync(path.join(os.tmpdir(),'folio-search-'))); t.after(()=>store.close());
  let called;
  const discovery = new Discovery(store,{fetchImpl:async url => { called=url; return {ok:true,json:async()=>({message:{items:[{DOI:'10.1234/seed',title:['Seed']},{DOI:'10.1234/result',title:['Research'],author:[{given:'Ada',family:'Lovelace'}],published:{'date-parts':[[2025]]}},{DOI:'10.1234/result',title:['Duplicate']}]}})}; }});
  const result=await discovery.search('graph & learning',{excludeDoi:'10.1234/seed'});
  assert.equal(called.origin,'https://api.crossref.org'); assert.equal(called.searchParams.get('query.bibliographic'),'graph & learning');
  assert.equal(result.items.length,1); assert.equal(result.items[0].authors,'Ada Lovelace');
  discovery.save(result.items[0]); discovery.save(result.items[0]); assert.equal(discovery.list().length,1);
  assert.equal(discovery.list()[0].url,'https://doi.org/10.1234%2Fresult');
  await assert.rejects(discovery.search(''),{code:'INVALID_QUERY'});
  assert.throws(()=>discovery.save({doi:'javascript:bad',title:'Unsafe'}),{code:'INVALID_REFERENCE'});
  const unavailable = new Discovery(store,{fetchImpl:async()=>({ok:false,status:429})});
  await assert.rejects(unavailable.search('test'),{code:'DISCOVERY_UNAVAILABLE'});
});

test('real Tectonic produces PDF, rejects stale source and reports TeX errors', {skip:process.env.FOLIO_TEST_TEX!=='1',timeout:240000}, async t => {
  const store = new Store(mkdtempSync(path.join(os.tmpdir(),'folio-tex-'))); t.after(()=>store.close());
  const compiler = new Compiler(store), project = store.create('Compile test',{'main.tex':'\\documentclass{article}\n\\begin{document}\nFolio compilation test. $E=mc^2$\n\\input{sections/result.tex}\n\\end{document}','sections/result.tex':'A nested project source.'});
  await assert.rejects(compiler.compile(project.id,99),{code:'REVISION_CONFLICT'});
  const build = await compiler.compile(project.id,1);
  assert.equal(build.status,'success',build.log); assert.equal(readFileSync(compiler.pdf(build.id)).subarray(0,5).toString(),'%PDF-');
  store.writeFile(project.id,1,'main.tex','\\documentclass{article}\n\\begin{document}\n\\NonexistentFolioCommand\n\\end{document}');
  const failed = await compiler.compile(project.id,2);
  assert.equal(failed.status,'failed'); assert.ok(failed.log); assert.equal(failed.pdf_url,null);
});
