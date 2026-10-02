---
title: ADR-007 Editor pane for composing
created: 2026-10-02T10:00:00+07:00
modified: 2026-10-02T10:00:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-007 Editor pane for composing

- **Status:** Accepted (maintainer request, 2026-10-02)
- **Date:** 2026-10-02
- **Supersedes in part:** [ADR-006](ADR-006-embedded-editor.md) (the embedded editor stays as an option, no longer the default)
- **Evidence:** native script `scripts/native/h5-editor-pane.js`; the maintainer's use of the composer

## Context

ADR-006 mounted Obsidian's editor inside the conversation by building a leaf outside the workspace layout.
In use it behaved like a quick preview, not like the editor the maintainer works in every day:
that leaf has no active-editor context (`workspace.activeEditor` was empty), so editor commands, hotkeys, and
plugins that act on the active editor did not apply to it, and its display depended on undocumented internals.
The maintainer asked for the normal editing experience with all plugins.

## Decision

- By default a message is written in an ordinary editor pane split off the conversation view
  (`workspace.createLeafBySplit`, public API). The composer dock stays under the conversation with Publish, Close,
  Go to editor, and the unpublished-draft note; it holds no editor of its own.
- The pane is a real leaf, so it has the full editing environment: active editor, commands, hotkeys, editor menus,
  and the behaviour of every other plugin, including formatters that act on the file.
- Publish saves the pane first, then changes the status, then removes the pane. Close saves and removes it.
  If the user closes the pane themselves, the dock closes and the file is left as it is.
  If the open file is deleted the composer closes; if it is renamed the composer follows it.
- The embedded editor (ADR-006) remains as the setting "Editor: Embedded below the conversation".
  It keeps the layout compact but is a quick-preview-style editor without the full environment.
- The setting is stored as `composerMode`: `split` (default) or `embedded`.

## Alternatives considered

- Keep only the embedded editor: rejected, it does not give the editing experience the maintainer wants.
- Open the message in a new tab: loses the conversation while writing.
- Split below instead of to the right: the thread needs vertical space; a side pane suits wide windows. A future setting could choose the direction.

## Consequences

- The conversation narrows while an editor pane is open. Closing the composer restores the layout.
- Other plugins that react to file edits (for example formatters) now apply while writing, as in any note.
- Only public workspace API is used for the default path, which removes the dependency on undocumented leaf internals for normal use.
- Popout windows work: the pane opens in the popout that shows the conversation.
