// Packages the ChatGPT app (OpenAI plugin) for upload on the OpenAI Platform:
// plugin.json, mcp.json and assets/ at the zip root. Run: pnpm chatgpt:zip
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const plugin = JSON.parse(readFileSync(`${here}plugin.json`, 'utf8'));
const pkg = JSON.parse(readFileSync(`${here}../package.json`, 'utf8'));
if (plugin.version !== pkg.version) {
	throw new Error(`chatgpt/plugin.json version ${plugin.version} doesn't match package.json ${pkg.version}`);
}
const out = `${here}dist/behaviortrees-chatgpt-${plugin.version}.zip`;
mkdirSync(`${here}dist`, { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-rX', out, 'plugin.json', 'mcp.json', 'assets'], { cwd: here, stdio: 'inherit' });
console.log(`Wrote ${out}`);
