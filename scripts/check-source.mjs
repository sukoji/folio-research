import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const directory of ['src','web','scripts','test','desktop']) {
  for (const name of readdirSync(new URL(`../${directory}/`,import.meta.url))) {
    if (!/\.(mjs|cjs|js)$/.test(name)) continue;
    execFileSync(process.execPath,['--check',`${directory}/${name}`],{stdio:'inherit',windowsHide:true});
  }
}
console.log('JavaScript syntax checks passed.');
