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

## Native QA

Automated checks do not replace testing in Obsidian.
Test on desktop 1.14.2, in the main window and in a popout window.
Report which scenarios were tested and which were not.

The scripted native checks live in `scripts/native/` and are described, with their latest results and the open items,
in [docs/native-acceptance.md](docs/native-acceptance.md).
Run one with `pnpm run native -- <vault name> scripts/native/h1-rename-matrix.js` against a vault you are willing to touch.

## Commits and pull requests

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with these types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`. A hook checks the message, and CI checks it again.
- Work on a short-lived branch and open a pull request. `main` accepts changes only through a pull request with green checks.
- Pull requests are squash-merged, so the **pull request title** becomes the commit on `main`. Write it as a Conventional Commit: `feat` and `fix` appear in the changelog and decide the next version.
- The pre-commit hook runs `pnpm run check`. Run `pnpm run verify` before pushing; CI runs the same command.
- Review comments use [Conventional Comments](https://conventionalcomments.org/) labels such as `issue`, `suggestion`, `question`, and `nitpick`.

## Releasing

Releases are automated with a human gate.

1. Every push to `main` updates one **Release PR** (`chore: release X.Y.Z`). It holds the next version in `package.json` and `manifest.json` and the new `CHANGELOG.md` section, both derived from the commits since the last release.
2. The maintainer reviews it: reword the changelog for readers, and for a minor or major release add the release record `docs/releases/X.Y.Z.md` from `docs/releases/TEMPLATE.md`. To release a different version than proposed, merge a commit whose body has the footer `Release-As: X.Y.Z`.
3. Merging the Release PR is the release decision. It creates the tag `X.Y.Z` (no `v` prefix) and the GitHub release; the workflow then runs `pnpm run verify`, attests the build, and attaches `main.js`, `manifest.json`, `styles.css`, and the plugin zip.

Before 1.0.0, a `feat` raises the patch number and a breaking change raises the minor number.

When `minAppVersion` changes, add `"X.Y.Z": "<new minAppVersion>"` to `versions.json` in the Release PR; `pnpm run verify` fails until it is there.

CI does not start by itself on the Release PR unless the repository secret `RELEASE_TOKEN` is set. Without it, push a commit to the Release PR branch or close and reopen the pull request.
