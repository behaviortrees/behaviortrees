import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import posthog from '@posthog/rollup-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

// The example trees live in @behaviortrees/examples (single source of truth,
// shared with the classic editor). Serve them at /examples in dev and copy
// them into dist/examples on build so /?example=<name> works everywhere.
const EXAMPLES_DIR = join(
	dirname(require.resolve('@behaviortrees/examples/package.json')),
	'trees'
);

const examplesPlugin = (): Plugin => ({
	name: 'shared-examples',
	configureServer(server) {
		server.middlewares.use('/examples', (req, res, next) => {
			const url = (req as { url?: string }).url ?? '';
			const name = url.replace(/^\//, '').split('?')[0];
			if (!/^[\w-]+\.json$/.test(name)) return next();
			try {
				const body = readFileSync(join(EXAMPLES_DIR, name));
				res.setHeader('Content-Type', 'application/json');
				res.end(body);
			} catch {
				next();
			}
		});
	},
	closeBundle() {
		const out = join(HERE, 'dist/examples');
		mkdirSync(out, { recursive: true });
		for (const file of readdirSync(EXAMPLES_DIR)) {
			if (file.endsWith('.json')) {
				copyFileSync(join(EXAMPLES_DIR, file), join(out, file));
			}
		}
	},
});

// Upload source maps to PostHog error tracking so production stack traces are
// readable. Only when the build has a key (the Vercel production env); other
// builds skip it. The plugin emits hidden maps and deletes them after upload,
// so they're never served.
const SOURCEMAP_KEY = process.env.POSTHOG_SOURCEMAP_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

const posthogSourcemaps = (): Plugin => {
	const plugin = posthog({
		personalApiKey: SOURCEMAP_KEY ?? '',
		projectId: POSTHOG_PROJECT_ID,
		sourcemaps: {
			enabled: Boolean(SOURCEMAP_KEY && POSTHOG_PROJECT_ID),
			releaseName: 'behaviortrees-editor',
			releaseVersion: process.env.VERCEL_GIT_COMMIT_SHA,
			// Bind the release at upload time. The default 'event' mode calls the
			// PostHog API while rendering chunks, where a failure can't be caught.
			releaseMode: 'symbol-set',
		},
	}) as Plugin;
	// A failed upload (bad key, PostHog down) must not fail the deploy. Warn,
	// and remove the maps the plugin would have deleted after uploading.
	const writeBundle = plugin.writeBundle;
	if (writeBundle && typeof writeBundle === 'object') {
		const upload = writeBundle.handler;
		writeBundle.handler = async function (options, bundle) {
			try {
				await upload.call(this, options, bundle);
			} catch (error) {
				console.warn(`PostHog source map upload failed, deploying without it: ${error}`);
				const maps = Object.keys(bundle).filter((file) => file.endsWith('.map'));
				await Promise.all(maps.map((file) => rm(join(options.dir ?? '', file), { force: true })));
			}
		};
	}
	return plugin;
};

export default defineConfig({
	plugins: [react(), tailwindcss(), examplesPlugin(), posthogSourcemaps()],
	server: {
		// The sync API runs as Vercel functions; in dev, run `vercel dev --listen
		// 3000` alongside vite so /api hits real functions while keeping HMR.
		proxy: {
			'/api': 'http://localhost:3000',
		},
	},
	test: {
		// Tests always run the local-only app: without this, a filled-in
		// .env.local flips CLOUD_ENABLED and App renders Clerk components
		// that need a provider only main.tsx supplies.
		env: { VITE_CLERK_PUBLISHABLE_KEY: '' },
	},
});
