export function pdfFixture(content = 'Evidence from the first page.') {
  const stream = `BT /F1 14 Tf 50 740 Td (${content}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let result = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}

export async function scannedPdfFixture() {
  const {createCanvas} = await import('@napi-rs/canvas');
  const canvas = createCanvas(1400,500), ctx = canvas.getContext('2d');
  ctx.fillStyle='white'; ctx.fillRect(0,0,1400,500); ctx.fillStyle='black'; ctx.font='48px sans-serif';
  ctx.fillText('FOLIO RESEARCH EVIDENCE',70,120);
  ctx.fillText('Local OCR reads scanned papers.',70,220);
  ctx.fillText('The result stays on this computer.',70,320);
  const image = canvas.toBuffer('image/jpeg');
  const stream='q 700 0 0 250 0 0 cm /Im1 Do Q';
  const objects = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 250] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>'),Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1400 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),image,Buffer.from('\nendstream')]),Buffer.from(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)];
  const parts=[Buffer.from('%PDF-1.4\n')], offsets=[0]; let length=parts[0].length;
  objects.forEach((object,i) => { offsets.push(length); const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]); parts.push(part); length+=part.length; });
  parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`));
  return Buffer.concat(parts);
}
