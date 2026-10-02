---
title: ADR-006 Embedded editor
created: 2026-10-02T00:20:00+07:00
modified: 2026-10-02T00:20:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-006 Embedded editor

- **Status:** Accepted (maintainer, 2026-10-02); superseded in part by [ADR-007](ADR-007-editor-pane.md), which makes the editor pane the default and keeps this embedded editor as an option
- **Date:** 2026-10-02
- **Evidence:** [S2](spike-s2-embedded-editor.md); decision K-06 in the [plan](../implementation-plan.md)

## Context

Composing and editing should use Obsidian's native Markdown editor, but Obsidian offers no public API to embed one.
Unimian's Quick Preview, GPL-3.0-only, embeds a `MarkdownView` through undocumented `WorkspaceLeaf` internals.

## Decision

- Adapt Unimian's `detachedLeaf.ts` and the lifecycle pattern of `QuickPreviewModal.ts`,
  keeping the SPDX header, copyright, and a change note, and list the files in `THIRD_PARTY_NOTICES.md`.
  The mobile branch and the backlinks panel are not carried over.
- Isolate the technique in one file under `src/platform/editor/`.
  It returns `null`, never throws, when the expected shape is absent.
- Set the leaf's `parent` to the window container (`hostLeaf.getContainer()`: the root split or the popout window) of the view that mounts it, never to that view's tab group: activating the leaf selects it in its parent tab group, and a leaf that is not one of the group's tabs makes Obsidian switch the visible tab to the first tab (found by the maintainer, 2026-10-02).
- Detach the leaf on view unload, on window close, and on composer dismissal; restore the previously active leaf afterwards.
- When no embedded leaf can be made, offer an explicit action that opens the file in an ordinary editor tab.

## Alternatives considered

- Building a custom editor on CodeMirror: duplicates Obsidian's editing behaviour and diverges from it.
- Always opening notes in a normal tab: loses the conversation flow.

## Consequences

- An Obsidian update can break the undocumented API; the fallback keeps authoring possible and task H2 re-checks it.
- The plugin stays GPL-3.0-only.
