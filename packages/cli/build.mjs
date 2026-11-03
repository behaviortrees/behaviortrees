// Bundles the CLI, the library and the MCP server entry into dist/, including
// the editor's tree code they import from apps/editor/src. Runtime deps stay
// external and install from npm.
import { chmod, copyFile, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));

await rm('dist', { recursive: true, force: true });
await build({
	entryPoints: { cli: 'src/cli.ts', index: 'src/index.ts', mcp: 'src/server.ts' },
	outdir: 'dist',
	bundle: true,
	splitting: true,
	format: 'esm',
	platform: 'node',
	target: 'node20',
	external: Object.keys(pkg.dependencies),
	define: { __VERSION__: JSON.stringify(pkg.version) },
	chunkNames: 'chunks/[name]-[hash]',
	logLevel: 'warning',
});

const cli = 'dist/cli.js';
await writeFile(cli, `#!/usr/bin/env node\n${await readFile(cli, 'utf8')}`);
await chmod(cli, 0o755);

for (const file of await readdir('types')) await copyFile(`types/${file}`, `dist/${file}`);
