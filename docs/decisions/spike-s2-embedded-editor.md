---
title: Spike S2 — Embedded editor in main and popout windows
created: 2026-10-02T00:10:00+07:00
modified: 2026-10-02T00:10:00+07:00
tags:
  - unistoria
  - spike
  - evidence
---

# Spike S2 — Embedded editor in main and popout windows

Evidence for ADR-006 (editor reuse) and tasks C3, C5, and H2.
It answers R-05 from the [specification evaluation](../unistoria-spec-evaluation.md).

## Setup

- Obsidian desktop `1.14.3`, the maintainer's working vault. Method as in [spike S1](spike-s1-relative-links.md).
- Technique under test: the one Unimian's `detachedLeaf.ts` uses.
  Construct a `WorkspaceLeaf` with the constructor Obsidian provides, set the undocumented `parent`, call `openFile`,
  then mount `leaf.containerEl` in an element of our own.
  The spike mounted it in a plain overlay element, not yet in an `ItemView`.
- Windows tested: the main window, and a popout window opened with `workspace.openPopoutLeaf()`.

## Findings

### 1. Main window

| Check | Result |
| --- | --- |
| Leaf opens a real `MarkdownView` (`source` mode) | Yes |
| `view.editor` and the CodeMirror instance exist, in the main document | Yes |
| `setValue` on the editor persists to the file | Yes, after Obsidian's normal save delay (about two seconds) |
| Obsidian's own view header (mode toggle, "..." container) is present | Yes |
| The Properties panel renders inside the embedded view | Yes |
| Switching to reading mode through `setState` | Works |
| The leaf appears in the workspace layout | No (zero extra Markdown leaves) |
| Detaching removes it cleanly | Yes |
| `workspace.activeLeaf` while mounted | **The detached leaf**, so commands run against it |

### 2. Popout window

| Check | Parent = main window root split | Parent = the popout's own split |
| --- | --- | --- |
| Editor DOM belongs to the popout document | Yes | Yes |
| Editing and saving work | Yes | Yes |
| `leaf.getContainer().win` | **The main window** (wrong) | The popout (correct) |

Both variants edit correctly. With the main-window parent, anything Obsidian resolves through the leaf's container
(Page Preview popovers, menus) is associated with the wrong window.
Choose the parent from the window that owns the mounting element, as already noted in plan section 4.1.

### 3. Closing the popout while the editor is mounted

After the popout was closed, the embedded leaf's container still reported `isConnected: true` and its view stayed alive.
Nothing is released automatically: the plugin must detach the leaf itself
when its view unloads, when the popout window closes, and when the composer is dismissed.
Task H2 verifies there is no orphan leaf or listener afterwards.

### 4. Side effects seen

- The unrelated community plugin Omnisearch logged `MiniSearch: cannot discard document` while the S1 fixtures were moved and trashed.
  It is not caused by the embedded editor.
- Calling `workspace.getLeaf("tab")` to obtain the leaf constructor creates a real tab; production code must import `WorkspaceLeaf` from `obsidian` instead.

## Decisions that follow

- Adopt the technique (K-06), isolated in one file under `src/platform/editor/`, returning `null` on any unexpected shape.
- Set the leaf's `parent` to the owning window's container, not to the host view's tab group (see the correction below). Never hard-code the main window's root split.
- Own the lifecycle explicitly: detach on view unload, on window close, and on composer dismissal.
- The embedded leaf becoming the active leaf is expected; restore the previously active leaf when the composer closes
  so that the user's keyboard focus and commands return to where they were.
- Keep the native-editor fallback (open the file in an ordinary tab) for when the leaf cannot be created.

## Not covered

- Mounting inside a real `ItemView` and inside a `Modal`, and layout and sizing inside a thread card.
- Visual checks (theme, header colors, the hover-popover layer noted in Unimian's styles) and the "..." menu contents.
- Undo history across mounts, IME input, and spellcheck in the popout.
- Several embedded editors alive at once (reply composer plus edit).
- Behaviour after a plugin reload while an editor is mounted.

## Correction (2026-10-02)

Variant B above used the popout's tab group (`popLeaf.parent`) as the leaf's parent.
In the main window the equivalent choice, the host view's tab group, caused a real defect:
with two or more tabs open, opening the composer made Obsidian select the first tab instead of the conversation,
and clicking into the editor did the same. The spike did not catch it because it never had a second tab open
and never focused the embedded editor as a user does.

The parent must be the window container: `hostLeaf.getContainer()` (the root split in the main window, the window object in a popout).
This keeps `leaf.getContainer().win` correct without being a tab group.
Verified with two tabs open: the conversation stays displayed after opening the composer and after clicking in the editor.
Task H2 repeats the check in a popout window and with several tab groups (splits).
