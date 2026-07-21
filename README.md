<img src="logo.svg" alt="Behavior Trees logo" width="96" align="left">

# Behavior Trees Editor

<br clear="left">

![The React editor with the Enemy Patrol AI example open](preview.png)

A free, open-source visual editor for behavior trees, live at [behaviortrees.com](https://www.behaviortrees.com). Model AI for games, robotics, and simulations, then export to an open JSON format you can load with any [behavior3](http://behavior3.com)-compatible library.

Originally based on [behavior3editor](https://github.com/behavior3/behavior3editor) by Renato de Pontes Pereira, since rebuilt as a modern React editor on the Nocturne design system and extended with a guides site. The original AngularJS editor lives on at [old.behaviortrees.com](https://old.behaviortrees.com).

## What's in this repo

A pnpm + [Turborepo](https://turborepo.com) monorepo:

| Path | What it is | Where it deploys |
|------|------------|------------------|
| `apps/editor/` | Main editor (React + TypeScript + React Flow) | [behaviortrees.com](https://www.behaviortrees.com) |
| `apps/editor-classic/` | Classic editor (AngularJS + gulp) | [old.behaviortrees.com](https://old.behaviortrees.com) |
| `apps/site/` | Guides and articles (Astro) | [behaviortrees.com/learn](https://www.behaviortrees.com/learn/) |
| `packages/examples/` | Shared example trees consumed by both editors | bundled into both editors |

`apps/editor-classic` is intentionally **not** a workspace member — its gulp 3 toolchain keeps its own npm lockfile. Never run pnpm inside it.

## Features

- **Custom nodes**: create your own node types in any of the four basic categories — *composite*, *decorator*, *action*, or *condition*
- **Node properties**: edit titles, descriptions, and custom properties per node instance
- **Manual and auto layout**: drag nodes around, or press `a` to auto-organize the whole tree
- **Multiple trees per project**: create and manage as many trees as you need
- **JSON import/export**: an open format that works with any behavior3-compatible runtime
- **No lock-in**: runs in the browser, no accounts, no external tools or engines required

## Development

```sh
git clone https://github.com/behaviortrees/behaviortrees.git
cd behaviortrees
pnpm install

pnpm dev --filter @behaviortrees/editor   # React editor (Vite)
pnpm dev --filter @behaviortrees/site     # guides site (Astro)
pnpm build                                # build editor + site via Turborepo
pnpm test                                 # editor test suite
```

### Classic editor

Uses Node <= 22 (see `.nvmrc`) and its own npm toolchain:

```sh
pnpm build:classic          # npm install + bower install + gulp build, from the repo root
# or, inside apps/editor-classic:
npm install --ignore-scripts
npx bower install
gulp serve                  # live reload at http://127.0.0.1:8000
```

## Deployment

The React editor deploys to [behaviortrees.com](https://www.behaviortrees.com) through `apps/editor/vercel.json` (Vercel root directory: `apps/editor`); its build also bundles the guides site so `/learn` is served from the same deploy. `build-deploy.sh` builds the classic editor and the guides site, merging both into `deploy/` as the static site Netlify serves at [old.behaviortrees.com](https://old.behaviortrees.com) (via `netlify.toml`).

## License

- The classic editor and repo root are **MIT** — see [LICENSE](LICENSE), © 2014 Renato de Pontes Pereira.
- The React editor (`apps/editor/`) is **AGPL-3.0** © Alan Hoskins, with portions derived from the MIT original — see [apps/editor/LICENSE](apps/editor/LICENSE) and [apps/editor/LICENSE-MIT](apps/editor/LICENSE-MIT).

Credit to the original [behavior3](https://github.com/behavior3) team for the editor this project grew from.
