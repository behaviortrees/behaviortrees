// Runs after `vite build`: renders the public pages to static HTML in dist/
// (see src/prerender.tsx). dist/index.html keeps its empty #root as app.html,
// the shell for the app-only routes (/editor, /projects, ...).
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE = 'https://www.behaviortrees.com';
const EMPTY_ROOT = '<div id="root"></div>';

const escapeAttr = (value) =>
	value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const replaceOnce = (html, pattern, replacement, label) => {
	if (!pattern.test(html)) throw new Error(`prerender: ${label} not found in index.html`);
	return html.replace(pattern, () => replacement);
};

const setMeta = (html, attr, name, value) =>
	replaceOnce(
		html,
		new RegExp(`<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/>`),
		`<meta ${attr}="${name}" content="${value}" />`,
		name
	);

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!shell.includes(EMPTY_ROOT)) throw new Error('prerender: empty #root not found in index.html');
writeFileSync(join(DIST, 'app.html'), shell);

// Bundle everything: several deps (react-router-dom among them) are CommonJS
// under Node and only work after Rollup's CommonJS transform. No config file,
// so the PostHog source map upload in vite.config.ts never runs here.
const OUT = join(ROOT, 'node_modules/.tmp/prerender');
await build({
	root: ROOT,
	configFile: false,
	logLevel: 'error',
	plugins: [react()],
	ssr: { noExternal: true },
	build: { ssr: 'src/prerender.tsx', outDir: OUT, emptyOutDir: true, minify: false },
});

try {
	const { ROUTES, renderRoute } = await import(pathToFileURL(join(OUT, 'prerender.js')).href);
	for (const route of ROUTES) {
		const url = `${SITE}${route.path}`;
		const title = escapeText(route.title);
		const description = escapeAttr(route.description);
		let html = shell;
		html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'title');
		html = setMeta(html, 'name', 'description', description);
		html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, 'canonical');
		html = setMeta(html, 'property', 'og:url', url);
		if (route.path !== '/') {
			for (const [attr, name] of [['property', 'og:title'], ['name', 'twitter:title']]) {
				html = setMeta(html, attr, name, escapeAttr(route.title));
			}
			for (const [attr, name] of [['property', 'og:description'], ['name', 'twitter:description']]) {
				html = setMeta(html, attr, name, description);
			}
		}
		if (route.jsonLd) {
			const json = JSON.stringify(route.jsonLd).replace(/</g, '\\u003c');
			html = html.replace('</head>', () => `\t<script type="application/ld+json">${json}</script>\n\t</head>`);
		}
		const body = renderRoute(route);
		html = html.replace(EMPTY_ROOT, () => `<div id="root">${body}</div>`);
		writeFileSync(join(DIST, route.file), html);
		console.log(`prerendered ${route.path} -> dist/${route.file}`);
	}
} finally {
	rmSync(OUT, { recursive: true, force: true });
}
