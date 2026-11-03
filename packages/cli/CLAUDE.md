# CLAUDE.md

`behaviortrees` on npm: a CLI (`src/cli.ts`), a library (`src/index.ts`) and an MCP server (`src/mcp.ts`, plus the stateless Streamable HTTP handler in `src/http.ts`).

- The tree logic is the editor's own (`apps/editor/src/lib/behavior`, `lib/share-link.ts`), imported through `src/core/editor.ts` and bundled by `build.mjs` (esbuild). Never fork that logic here; change it in the editor so both stay identical. Editor code it pulls in must run in Node: no browser globals at import time.
- BT.CPP import needs `DOMParser`; `src/core/xml-dom.ts` installs one backed by @xmldom/xmldom (jsdom fails to load on Vercel's runtime). It passes the editor's BT.CPP test suite except one assertion on jsdom's exact error wording.
- `src/core/validate.ts` is the one piece with no editor equivalent: structural checks on behavior3 input as written, which the editor's import silently smooths over.
- Types for consumers are hand-written in `types/` (copied to `dist/` on build). Keep them in sync with `src/index.ts` and `src/server.ts`.
- `src/core/catalog.ts` imports each example tree explicitly; a test fails if one in `packages/examples/trees` is missing.
- Guides are fetched live from `/learn/guides.json` and `/learn/<slug>.md` (Astro endpoints in `apps/site`). `BEHAVIORTREES_SITE` overrides the base URL.
- The public MCP server is `apps/editor/api/mcp.ts`, rewritten from `/mcp` in `apps/editor/vercel.json`. The editor depends on this package, so Turborepo builds it first.
- Publishing: bump `version` in both `package.json` and `server.json`, `pnpm build`, `npm publish`, then `mcp-publisher publish` (MCP Registry; `name` must match `mcpName`).
- The tool descriptions in `src/mcp.ts` are the model's only documentation; `llms.txt` (`apps/site/src/pages/llms.txt.js`) and `README.md` describe the same tools, so update all three together.

Commands: `pnpm build`, `pnpm test`, `pnpm lint` (typecheck).
