# CLAUDE.md

`behaviortrees` on npm: a CLI (`src/cli.ts`), a library (`src/index.ts`) and an MCP server (`src/mcp.ts`, plus the stateless Streamable HTTP handler in `src/http.ts`).

- The tree logic is the editor's own (`apps/editor/src/lib/behavior`, `lib/share-link.ts`), imported through `src/core/editor.ts` and bundled by `build.mjs` (esbuild). Never fork that logic here; change it in the editor so both stay identical. Editor code it pulls in must run in Node: no browser globals at import time.
- Turborepo only hashes a package's own files, so `turbo.json` here lists the editor's `src/lib` and `src/types` as inputs to build, test and lint. Without them, Vercel's remote cache replays a stale CLI build, and `/mcp` keeps serving old tree code after editor changes. If the CLI starts importing editor code from anywhere else, add that path there.
- BT.CPP import needs `DOMParser`; `src/core/xml-dom.ts` installs one backed by @xmldom/xmldom (jsdom fails to load on Vercel's runtime). It passes the editor's BT.CPP test suite except one assertion on jsdom's exact error wording.
- `src/core/validate.ts` is the one piece with no editor equivalent: structural checks on behavior3 input as written, which the editor's import silently smooths over.
- Types for consumers are hand-written in `types/` (copied to `dist/` on build). Keep them in sync with `src/index.ts` and `src/server.ts`.
- `src/core/catalog.ts` imports each example tree explicitly; a test fails if one in `packages/examples/trees` is missing.
- Guides are fetched live from `/learn/guides.json` and `/learn/<slug>.md` (Astro endpoints in `apps/site`). `BEHAVIORTREES_SITE` overrides the base URL.
- The public MCP server is `apps/editor/api/mcp.ts`, rewritten from `/mcp` in `apps/editor/vercel.json`. The editor depends on this package, so Turborepo builds it first.
- Publishing, from `main` with a clean tree:
  1. Bump `version` in both `package.json` and `server.json`, merge, then `pnpm build && pnpm test`.
  2. `pnpm publish --access public --otp=<code>`. Use pnpm, not npm: only pnpm rewrites the `workspace:*` devDependency. The npm account has 2FA, so the maintainer supplies the code.
  3. `mcp-publisher login github --token "$(gh auth token)" && mcp-publisher publish`. The org namespace (`io.github.behaviortrees/*`) needs a token that can read org roles; the interactive `mcp-publisher login github` only grants the personal namespace. Registry logins expire within minutes, so chain the two. `name` must match `mcpName` in `package.json`.
- The tool descriptions in `src/mcp.ts` are the model's only documentation; `llms.txt` (`apps/site/src/pages/llms.txt.js`) and `README.md` describe the same tools, so update all three together.

Commands: `pnpm build`, `pnpm test`, `pnpm lint` (typecheck).

ChatGPT app: `chatgpt/` holds the OpenAI plugin package (`plugin.json`, `mcp.json`, `assets/`), including the review test cases. `pnpm chatgpt:zip` writes `chatgpt/dist/behaviortrees-chatgpt-<version>.zip` for upload on the OpenAI Platform; its version must match `package.json`. Domain verification is served at `/.well-known/openai-apps-challenge` from the `OPENAI_APPS_CHALLENGE` Vercel environment variable (`apps/editor/api/openai-apps-challenge.ts`). MCP tool changes don't need a new zip: deploy, then Rescan in the portal.
