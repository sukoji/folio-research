import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'node:url';

const client = new Client({ name: 'folio-doctor', version: '1.0.0' });
try {
  const transport = process.argv.includes('--http')
    ? new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${process.env.FOLIO_PORT || 4317}/mcp`))
    : new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url)), '--stdio'], stderr: 'inherit' });
  await client.connect(transport);
  const tools = await client.listTools();
  const result = await client.callTool({ name: 'folio_workspace_info', arguments: {} });
  if (result.isError) throw new Error(result.content[0].text);
  console.log(`PASS: MCP initialized; ${tools.tools.length} tools available.`);
  console.log(result.content[0].text);
} catch (error) {
  console.error(`FAIL: ${error.message}`); process.exitCode = 1;
} finally { await client.close(); }
