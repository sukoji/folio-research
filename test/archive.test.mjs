import test from 'node:test';
import {createCanvas} from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yazl from 'yazl';
import { Store } from '../src/store.mjs';
import { importArchive, exportArchive } from '../src/archive.mjs';
import { Compiler } from '../src/compiler.mjs';
async function collect(stream){const chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks);}
async function archive(entries){const z=new yazl.ZipFile();for(const [name,content]of Object.entries(entries))z.addBuffer(Buffer.from(content),name);z.end();return collect(z.outputStream);}
test('project ZIP preserves nested sources, binary figures and bibliography across export and revisions',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'folio-import-'));const store=new Store(dir);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const canvas=createCanvas(20,20);canvas.getContext('2d').fillRect(0,0,20,20);const png=canvas.toBuffer('image/png');
  const bytes=await archive({'main.tex':'\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\\input{sections/body}\n\\includegraphics{figures/pixel.png}\n\\end{document}', 'sections/body.tex':'Hello imported project.', 'references.bib':'@article{test,title={Example}}','figures/pixel.png':png,'build.log':'ignored'});
  const result=await importArchive(store,bytes,'Imported');assert.deepEqual(result.skipped,['build.log']);assert.equal(result.project.assets.length,1);
  assert.deepEqual(Buffer.from(store.assets(result.project.id)[0].content),png);
  const edited=store.writeFile(result.project.id,1,'sections/body.tex','Updated body.');store.restore(edited.id,2,1);
  const roundtrip=await importArchive(store,await collect(exportArchive(store,edited.id)),'Round trip');assert.deepEqual(roundtrip.project.files,result.project.files);assert.deepEqual(Buffer.from(store.assets(roundtrip.project.id)[0].content),png);
  const wrapper=await importArchive(store,await archive({'project/main.tex':'\\documentclass{article}','project/sections/test.tex':'body','project/figures/a.png':png}),'Wrapper');assert.ok(wrapper.project.files['main.tex']);assert.equal(wrapper.project.assets[0].name,'figures/a.png');
  const exported=store.export(edited.id);assert.deepEqual(readFileSync(path.join(exported.directory,'figures/pixel.png')),png);
  if(process.env.FOLIO_TEST_TEX==='1'){const compiled=await new Compiler(store).compile(edited.id,3,'main.tex');assert.equal(compiled.status,'success',compiled.log);}
});
test('archive failures leave no partial project; duplicate and unsafe paths are rejected',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'folio-import-invalid-'));const store=new Store(dir);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  await assert.rejects(importArchive(store,Buffer.from('not zip'),'Bad'));
  await assert.rejects(importArchive(store,await archive({'Main.tex':'x','main.tex':'y'}),'Duplicate'));
  await assert.rejects(importArchive(store,await archive({'main.tex':'x','CON.txt':'y'}),'Unsafe'));
  await assert.rejects(importArchive(store,await archive({'readme.txt':'x'}),'No source'));
  const unsafe=await archive({'aaa.tex':'x'}); // same-length path rewrite includes ZIP central directory
  const traversed=Buffer.from(unsafe);for(let start=0;(start=traversed.indexOf('aaa.tex',start))!==-1;start+=7)traversed.write('../x.tx',start);
  await assert.rejects(importArchive(store,traversed,'Traversal'));
  assert.equal(store.list().length,0);
});
