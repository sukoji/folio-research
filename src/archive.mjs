import yauzl from 'yauzl';
import yazl from 'yazl';
import { readFileSync, statSync } from 'node:fs';
import { WorkspaceError, fileName } from './store.mjs';

const limit = 20 * 1024 * 1024;
export async function importArchive(store, bytes, name) {
  if (!Buffer.isBuffer(bytes) || bytes.length > limit) throw new WorkspaceError('ZIP_LIMIT', 'ZIP은 20 MiB 이하여야 합니다.');
  const files = {}, assets = [], skipped = [], seen = new Set(); let size = 0, count = 0;
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error) return reject(new WorkspaceError('INVALID_ZIP', 'ZIP 파일을 읽지 못했습니다.'));
      const fail = e => { zip.close(); reject(e instanceof WorkspaceError ? e : new WorkspaceError('INVALID_ZIP', '손상되었거나 지원하지 않는 ZIP입니다.')); };
      zip.on('error', fail); zip.on('end', resolve);
      zip.on('entry', entry => {
        try {
          if (++count > 500 || (size += entry.uncompressedSize) > 50 * 1024 * 1024) throw new WorkspaceError('ZIP_LIMIT', '압축 해제 크기 50 MiB 또는 500개 항목 제한을 초과했습니다.');
          if (((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new WorkspaceError('UNSAFE_ZIP', '심볼릭 링크를 가져올 수 없습니다.');
          const path = entry.fileName;
          fileName((path.endsWith('/') ? path.slice(0,-1) : path) + '.txt');
          if (path.endsWith('/')) return zip.readEntry();
          if (seen.has(path.toLowerCase())) throw new WorkspaceError('DUPLICATE_FILE', '대소문자를 포함해 중복되는 파일명이 있습니다.');
          seen.add(path.toLowerCase());
          const text = /\.(tex|bib|md|txt|cls|sty|bst|csv|bbx|cbx|lbx|def|cfg|clo|bbl|tikz|pgf|dat)$/i.test(path);
          const binary = /\.(png|jpe?g|pdf|eps|svg|webp|ttf|otf)$/i.test(path);
          if (!text && !binary) { skipped.push(path); return zip.readEntry(); }
          if (entry.uncompressedSize > (text ? 2 * 1024 * 1024 : limit)) throw new WorkspaceError('ZIP_LIMIT', '개별 파일 크기 제한을 초과했습니다.');
          zip.openReadStream(entry, (err, stream) => {
            if (err) return fail(err);
            const chunks = []; let received = 0;
            stream.on('data', chunk => { received += chunk.length; if (received > entry.uncompressedSize || received > limit) stream.destroy(new Error('Size mismatch')); else chunks.push(chunk); });
            stream.on('error', fail);
            stream.on('end', () => {
              try {
                const content = Buffer.concat(chunks);
                if (text) files[path] = new TextDecoder('utf-8', { fatal: true }).decode(content);
                else assets.push({ name: path, bytes: content });
                zip.readEntry();
              } catch (e) { fail(e); }
            });
          });
        } catch (e) { fail(e); }
      }); zip.readEntry();
    });
  });
  if (!Object.keys(files).some(n => /\.tex$/i.test(n))) throw new WorkspaceError('NO_TEX', 'LaTeX 소스(.tex)가 없는 ZIP입니다. PDF만 내보낸 파일은 라이브러리에 넣어 주세요.');
  const names=[...Object.keys(files),...assets.map(a=>a.name)],prefix=names[0]?.split('/')[0]+'/';
  if(names.length && names.every(n=>n.startsWith(prefix))){for(const [key,value]of Object.entries(files)){delete files[key];files[key.slice(prefix.length)]=value;}for(const asset of assets)asset.name=asset.name.slice(prefix.length);}
  const project = store.create(name, files, assets);
  return { project, skipped, entrypoints: Object.keys(files).filter(n => /\\documentclass\b/.test(files[n]) && n.endsWith('.tex')) };
}
export function importArchiveFile(store, filename, name) { if(statSync(filename).size>limit)throw new WorkspaceError('ZIP_LIMIT','ZIP은 20 MiB 이하여야 합니다.');return importArchive(store, readFileSync(filename), name); }
export function exportArchive(store, id) {
  const project = store.get(id), zip = new yazl.ZipFile();
  for (const [name, text] of Object.entries(project.files)) zip.addBuffer(Buffer.from(text), name);
  for (const asset of store.assets(id)) zip.addBuffer(Buffer.from(asset.content), asset.name);
  zip.end(); return zip.outputStream;
}
