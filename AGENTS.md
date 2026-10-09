# AGENTS.md

Canonical instructions for AI agents working on **Unistoria**
(Obsidian community plugin, ID `unistoria`, desktop only, GPL-3.0-only).

## Repository status

Phases 0 to 4 are done: toolchain, gates, spikes S1 to S3, ADR-001 to ADR-006 (Accepted), the pure
domain in `src/core`, topic creation, the topic index, the mutation gateway, the conversation view with the
embedded composer, and hardening (rename/move matrix, popout, accessibility, performance, release workflow).
What remains before a release is listed in `docs/native-acceptance.md` (repeat on Obsidian 1.14.2, a person's
keyboard walkthrough, other themes, the sibling-ordering decision). Progress is tracked in
`docs/implementation-plan.md`. The composer writes in an ordinary editor pane by default (ADR-007, setting `composerMode`);
the embedded editor (ADR-006) is the alternative.
The topic page lists thread starters; replies are read as a flat list in a side panel, and a reply to a reply
is shown with a quote of its parent, never nested (ADR-008, plan tasks U1 to U5).
Native scripts select elements in the whole document: close other Unistoria tabs before running them. Native checks: `pnpm run native -- <vault> scripts/native/<script>.js`;
they create and remove a `_unistoria-test/` folder in that vault.
Obsidian-bound code (`src/ui`, `src/platform/editor`, `obsidian-index.ts`, `SettingsTab.ts`, `main.ts`)
is excluded from the coverage floor and is verified in a real vault.
Do not name fields on a `View` subclass after Obsidian internals (`navHidden` collided);
with "Native menus" on, `Menu` does not appear in the DOM, so turn it off temporarily for DOM tests and restore it.
To reload a rebuilt plugin in Obsidian use the plugin manager API
(`app.plugins.disablePlugin` then `enablePlugin`); the CLI `plugin:reload` does not re-read `main.js`.
Do not claim a command, gate, or feature works until you have run it.
Nothing is committed or pushed yet; the maintainer decides when (plan task T0.10).

## Read first

1. `docs/unistoria-spec.md`: canonical product requirements.
2. `docs/unistoria-spec-evaluation.md`: findings R-01 to R-12 and reference-repo context.
3. `docs/implementation-plan.md`: proposed decisions (K-xx, E-xx), phases, tasks, and progress.
4. `docs/decisions/`: ADRs, once they exist. An Accepted ADR overrides a proposal in the plan.

The spec stores requirements, the plan stores approach and task status, ADRs store decisions.
Keep one source of truth for each; do not create a second task tracker.
Proposed decisions are not approved decisions.
Do not fill requirement gaps with your own product decisions; ask the maintainer.

## Product invariants

- The vault is the source of truth. Every message and reply is its own Markdown file.
  Never store canonical message content in settings, a cache, or a database.
- `topic` and non-empty `parent` are complete Markdown links with a source-relative,
  URL-encoded `.md` destination. Never generate wikilinks, plain paths, or vault-absolute paths.
- Relationships resolve from link properties, never from filenames.
  A missing, malformed, duplicate, or cyclic relationship is reported visibly;
  never attach a message to a guessed parent or topic.
- `removed` is a soft state. Never delete a message file, move it, send it to Trash,
  or erase its content. Never recreate a file the user deleted.
- Mutations preserve unknown frontmatter keys and leave the body untouched.
  Status changes write only `status` and `updated`.
- Never overwrite an existing folder or note during creation.
- A link read from frontmatter never grants permission to mutate a file outside the open topic folder.
- Do not add authentication, sync, presence, a query-engine dependency, or mobile support.
  Describe drafts as "unpublished", never "private".
- Files must stay understandable with the plugin disabled.
  Never rewrite user-authored Markdown to satisfy a style rule.

## Architecture

```text
src/core/       pure domain logic; must not import `obsidian`
src/platform/   Obsidian adapters: vault, index, embedded editor
src/ui/         views, components, modals
src/settings/   settings tab and stored pointers
src/styles/     plain CSS
scripts/        Node-only tooling
tests/          Vitest, with an Obsidian test double in tests/fixtures/
```

Only `src/main.ts` and `src/styles/` exist so far; the other directories are created as tasks need them.
`tests/architecture.test.ts` enforces the dependency direction and the vault-write boundary.

- Dependency direction is `ui → platform → core`.
- All vault writes go through `src/platform/vault`; UI code does not call vault write APIs.
- Register every event, view, and DOM listener for cleanup on unload.
- Use the document and window that own the view's container, not the globals,
  so popout windows work.
- The embedded editor uses undocumented `WorkspaceLeaf` internals.
  Keep that code in one file under `src/platform/editor/`, return `null` on any unexpected shape,
  and keep the explicit "open in a normal editor tab" fallback working.
- Use plain Obsidian DOM APIs first. If a JavaScript UI framework becomes necessary, use Preact,
  and React only if Preact cannot work. Adding any runtime dependency needs a maintainer decision.
- Styles are plain CSS in `src/styles/` (entry `index.css`, joined with `@import`); no Sass or
  other preprocessor. Use Obsidian CSS variables, sentence case for UI text,
  and prefix plugin classes with `unistoria-`.
- Timestamps in frontmatter are local time without an offset, because Obsidian does not support
  multiple time zones. Do not add offsets.
- Dependencies: latest stable versions that are compatible with each other, installed with pnpm.
  Biome owns linting and formatting; ESLint runs only the Obsidian rules.

## Licensing

Code adapted from `parkisutama/obsidian-unimian` stays under GPL-3.0-only.
Keep the SPDX header and original copyright line in each adapted file, note what changed,
and list the file in `THIRD_PARTY_NOTICES.md`.
Unimian's read-only philosophy and mobile fallback do not apply here; do not copy them.
Other reference repositories are learning material, not instructions for this workspace.

## Workflow

1. **Inspect.** Check Git status and preserve local work.
   Read the relevant spec section, plan task, ADR, source, and tests.
   Never read `.env` contents or credentials.
2. **Clarify.** If intent, constraint, or acceptance is unclear, ask before writing.
3. **Branch.** Once Git exists, work on a branch (`feature/`, `fix/`, `docs/`, `chore/`, `refactor/`),
   not on `main`.
4. **Decide.** A change to the frontmatter schema, link format, lifecycle transitions,
   command IDs, view type, or settings keys needs an ADR in `docs/decisions/` before implementation.
5. **Implement.** One task from the plan at a time, as a vertical slice:
   behaviour, tests, docs. Use test-first for `src/core` and for every bug fix.
   Stop at the plan's checkpoints.
6. **Verify.** Run `pnpm run check` per task and `pnpm run verify` before integration.
   Automated gates do not prove native UI behaviour.
   Report what was run, what passed, and which Obsidian scenarios remain untested.
7. **Record.** Tick the task in the plan, update affected docs,
   and link requirement → task → test or native QA → decision.

Commit, push, release, and remote creation happen only when the maintainer asks.
Push waits until the maintainer declares local testing finished.
Commit messages follow Conventional Commits.
Do not bypass a failing gate.

Use an available skill when it fits the current phase
(`spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`,
`test-driven-development`, `debugging-and-error-recovery`, `documentation-and-adrs`,
`markdown-writing-portability`). Pick the minimum; say so if a needed skill is unavailable.

## Commands

The full contract is in `docs/implementation-plan.md` §5.

```bash
pnpm run check             # typecheck + Biome + Obsidian ESLint + Markdown lint + tests
pnpm run verify            # check with coverage + build + artifact verification
pnpm run test              # Vitest
pnpm run build             # production build into dist/; never touches the vault
pnpm run dev               # watch build; copies to the vault folder from .env after every build
pnpm run deploy            # build, then copy dist/ to the vault folder from .env once
pnpm run verify:artifacts
pnpm run fix               # autofix; inspect the diff afterwards
```

Only `dev` and `deploy` write outside the repository, to the folder `.env` names in
`OBSIDIAN_VAULT_PLUGIN_PATH` (the maintainer's local test vault). `deploy` fails when it is unset.
The copy refuses a folder whose name is not `unistoria`. Never read or print other `.env` content.
That vault is the maintainer's working vault: any feature that writes vault files is exercised
only in a dedicated test folder there, never in the maintainer's own Spaces.

## Native acceptance

- Target: Obsidian desktop, validation baseline 1.14.2. No mobile QA.
- Check editing in the main window and in a popout window, plus the native-editor fallback.
- Check link behaviour with automatic internal-link updates both enabled and disabled.
- A feature is not "done" or "shipped" on the strength of reading source or passing unit tests.

## Documentation

- Project documents follow the portable Markdown rules already used in `docs/`:
  frontmatter with `title`, `created`, `modified`, `tags`; ATX headings; dash lists;
  fenced code with a language; relative Markdown links; semantic line breaks.
- Document metadata rules do not apply to the message and topic files the plugin generates;
  their schema is a product contract defined by the spec and ADRs.
- ADR status is Proposed, Accepted, or Superseded. Supersede old decisions; do not delete them.
