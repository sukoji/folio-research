import { mkdirSync, writeFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const version = '0.17.0';
const targets = { 'win32-x64':'x86_64-pc-windows-msvc.zip', 'linux-x64':'x86_64-unknown-linux-musl.tar.gz', 'linux-arm64':'aarch64-unknown-linux-musl.tar.gz', 'darwin-x64':'x86_64-apple-darwin.tar.gz', 'darwin-arm64':'aarch64-apple-darwin.tar.gz' };
try {
  const target = targets[`${process.platform}-${process.arch}`];
  if (!target) throw new Error('Install Tectonic for your platform and set FOLIO_TECTONIC_PATH.');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const directory = path.join(root,'data/tools/tectonic'); mkdirSync(directory,{recursive:true});
  const metadata = await fetch(`https://api.github.com/repos/tectonic-typesetting/tectonic/releases/tags/tectonic%40${version}`,{headers:{'User-Agent':'FolioResearch'},signal:AbortSignal.timeout(30000)});
  if (!metadata.ok) throw new Error(`GitHub release metadata: HTTP ${metadata.status}`);
  const asset = (await metadata.json()).assets.find(a => a.name === `tectonic-${version}-${target}`);
  if (!asset || !/^sha256:[0-9a-f]{64}$/.test(asset.digest || '')) throw new Error('Release asset or SHA-256 digest unavailable; install Tectonic manually.');
  console.log(`Downloading ${asset.name} from the official Tectonic release…`);
  const response = await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(180000)});
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== asset.digest) throw new Error('Tectonic archive checksum mismatch.');
  const scratch = mkdtempSync(path.join(root,'data/tools/download-'));
  const archive = path.join(scratch,asset.name); writeFileSync(archive,bytes);
  execFileSync('tar',['-xf',archive,'-C',directory],{stdio:'inherit',windowsHide:true});
  const binary = path.join(directory,process.platform==='win32'?'tectonic.exe':'tectonic');
  if (process.platform!=='win32') chmodSync(binary,0o755);
  execFileSync(binary,['-X','compile','--help'],{stdio:'ignore',windowsHide:true});
  console.log(`Ready: ${binary}\nFirst compilation downloads TeX packages into Tectonic's local cache.`);
} catch(error) { console.error(error.message); process.exitCode=1; }
