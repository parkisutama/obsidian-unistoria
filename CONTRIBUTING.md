---
title: Contributing
created: 2026-10-01T22:20:00+07:00
modified: 2026-10-01T22:20:00+07:00
tags:
  - unistoria
  - contributing
---

# Contributing

AI agents follow [AGENTS.md](AGENTS.md); the workflow below applies to everyone.

## Setup

- Node.js 24. The version is pinned in `.node-version`; with [fnm](https://github.com/Schniz/fnm) run `fnm use`.
- pnpm, pinned in `package.json` (`packageManager`).
  pnpm selects the pinned version automatically when a different one is installed.

```bash
pnpm install --frozen-lockfile
```

pnpm refuses to resolve packages published less than 24 hours ago (`minimumReleaseAge`).
Wait a day before adopting a brand-new release.

## Local development

Create `.env` from `.env.example` and point it at the plugin folder of a test vault.
The folder name must equal the plugin ID, `unistoria`:

```text
OBSIDIAN_VAULT_PLUGIN_PATH=E:\MyVault\.obsidian\plugins\unistoria
```

`pnpm run dev` rebuilds on every change and copies `main.js`, `manifest.json`, and `styles.css` there.
`pnpm run deploy` builds and copies once; `pnpm run build` alone never writes to the vault.
The copy is refused when the folder name is not `unistoria` or the parent `plugins` folder is missing.
Without `.env`, the copy is skipped.
Reload the plugin in Obsidian after a rebuild.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run check` | typecheck, Biome, Obsidian ESLint, Markdown lint, tests |
| `pnpm run verify` | `check` with coverage, then build and artifact verification |
| `pnpm run test` | Vitest |
| `pnpm run build` | production build into `dist/`; never touches the vault |
| `pnpm run dev` | watch build; copies to the vault after every build |
| `pnpm run deploy` | build, then copy `dist/` to the vault once |
| `pnpm run fix` | autofix Biome and Markdown issues; inspect the diff afterwards |

The full contract, including write effects, is in the [implementation plan](docs/implementation-plan.md).

## Conventions

- Branches: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`, `refactor/<slug>`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/).
- Code formatting and linting are owned by Biome; do not hand-format.
- Styles are plain CSS in `src/styles/`, prefixed `unistoria-`, built on Obsidian CSS variables.
- A change to the frontmatter schema, link format, lifecycle, command IDs, or settings keys needs an ADR first.

## Releasing

1. `pnpm run version:sync -- 0.2.0` writes the version to `package.json`, `manifest.json`, and `versions.json`.
2. `pnpm run verify`, then commit.
3. Tag the commit with the same version and no `v` prefix (`0.2.0`) and push the tag.
   The Release workflow checks the tag against the three files, runs `verify`, and publishes `main.js`, `manifest.json`, `styles.css`, `LICENSE`, and `THIRD_PARTY_NOTICES.md`.

Tagging and pushing are done by the maintainer.

## Native QA

Automated checks do not replace testing in Obsidian.
Test on desktop 1.14.2, in the main window and in a popout window.
Report which scenarios were tested and which were not.

The scripted native checks live in `scripts/native/` and are described, with their latest results and the open items,
in [docs/native-acceptance.md](docs/native-acceptance.md).
Run one with `pnpm run native -- <vault name> scripts/native/h1-rename-matrix.js` against a vault you are willing to touch.
