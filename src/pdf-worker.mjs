import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

try {
  const task = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
  const doc = await task.promise;
  if (workerData.page) {
    const { createCanvas } = await import('@napi-rs/canvas');
    const page = await doc.getPage(workerData.page);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1200 / base.width, 1800 / base.height, 2) });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    parentPort.postMessage({ imageBase64: canvas.toBuffer('image/png').toString('base64') });
    await task.destroy();
    process.exit(0);
  }
  if (doc.numPages > 300) throw new Error('PDF는 300페이지까지 지원합니다.');
  const pages = [];
  let length = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('');
    length += text.length;
    if (length > 4_000_000) throw new Error('PDF 추출 텍스트가 너무 큽니다.');
    pages.push(text);
    page.cleanup();
  }
  const { info } = await doc.getMetadata();
  parentPort.postMessage({ pages, title: info.Title || '', authors: info.Author || '' });
  await task.destroy();
} catch (error) { parentPort.postMessage({ error: error.message }); }
