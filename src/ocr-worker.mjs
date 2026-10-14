import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import eng from '@tesseract.js-data/eng';
import kor from '@tesseract.js-data/kor';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

let worker, document;
try {
  document = await getDocument({data:new Uint8Array(workerData.bytes),isEvalSupported:false,useSystemFonts:true,verbosity:0}).promise;
  const page = await document.getPage(workerData.page), base = page.getViewport({scale:1});
  const viewport = page.getViewport({scale:Math.min(2400/base.width,3200/base.height,3)});
  const canvas = createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  mkdirSync(workerData.modelDir,{recursive:true});
  for (const lang of [eng,kor]) {
    const destination = path.join(workerData.modelDir,`${lang.code}.traineddata.gz`);
    if (!existsSync(destination)) copyFileSync(path.join(lang.langPath,`${lang.code}.traineddata.gz`),destination);
  }
  worker = await createWorker('eng+kor',1,{langPath:workerData.modelDir,cacheMethod:'none',gzip:true,errorHandler:() => {}});
  const {data} = await worker.recognize(canvas.toBuffer('image/png'));
  parentPort.postMessage({text:data.text.slice(0,200000),confidence:data.confidence});
} catch(error) { parentPort.postMessage({error:error.message}); }
finally { if(worker)await worker.terminate(); if(document)await document.destroy(); }
