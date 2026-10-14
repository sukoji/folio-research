import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const connection = { command: process.execPath, args: [path.join(root, 'src/server.mjs'), '--stdio'] };
const toml = `[mcp_servers.folio]\ncommand = ${JSON.stringify(connection.command)}\nargs = ${JSON.stringify(connection.args)}\n`;
const jsonPath = path.join(root, '.mcp.json');
const config = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : {};
config.mcpServers = { ...config.mcpServers, folio: { type: 'stdio', ...connection } };
writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
mkdirSync(path.join(root, '.codex'), { recursive: true });
const codexPath = path.join(root, '.codex/config.toml');
const old = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : '';
if (!old || old.trim().startsWith('[mcp_servers.folio]') && !old.trim().slice(1).includes('\n[')) {
  writeFileSync(codexPath, toml);
} else {
  writeFileSync(path.join(root, 'codex-folio.toml'), toml);
  console.log('Existing Codex project configuration preserved. Merge codex-folio.toml manually.');
}
console.log('Project MCP configuration is ready in .mcp.json and .codex/config.toml.');
console.log('Global registration is available through connect-codex.cmd or connect-claude.cmd.');
