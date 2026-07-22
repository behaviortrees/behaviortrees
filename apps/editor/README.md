# Behavior Tree Editor (React)

The editor at [www.behaviortrees.com](https://www.behaviortrees.com). A ground-up modernization of the classic editor built with React 19, TypeScript, Zustand, and React Flow, reading and writing the same behavior3 JSON format — projects round-trip cleanly between both editors.

## Development

```sh
pnpm install
pnpm dev        # dev server
pnpm test       # vitest
pnpm build      # type-check + production build
pnpm lint
```

## Cloud sync (optional)

Signed-in users get their projects synced across machines via Vercel serverless
functions (`api/`), Neon Postgres, and Clerk auth. Without the env vars below
the editor runs local-only (localStorage), exactly as before.

Setup:

1. Create a Neon database, put its connection string in `.env.local` as
   `DATABASE_URL`, and apply the schema:
   `node --env-file=.env.local scripts/apply-schema.mjs`
2. Create a Clerk application; grab the publishable + secret keys.
3. Copy `.env.example` to `.env.local` and fill in
   `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `DATABASE_URL`. Set the
   same three in the Vercel project settings for production.
4. Local dev runs the SPA and the functions side by side:

   ```sh
   vercel dev --listen 3000   # serves api/ functions
   pnpm dev                   # vite; proxies /api to :3000
   ```

Sync model: localStorage stays the source of truth on-device; a signed-in
session pushes saves (debounced) and runs a full last-write-wins merge on load,
sign-in, and reconnect. Conflicting edits from two devices keep the newer copy
and preserve the older one as a "(conflict copy)" project.

## License

[AGPL-3.0](LICENSE) © Alan Hoskins. If you run a modified version of this editor as a network service, the AGPL requires you to offer its source to your users.

Portions are derived from the MIT-licensed [behavior3editor](https://github.com/behavior3/behavior3editor) by Renato de Pontes Pereira — see [LICENSE-MIT](LICENSE-MIT).
