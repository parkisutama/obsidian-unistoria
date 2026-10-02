---
title: Third-Party Notices
created: 2026-10-01T22:20:00+07:00
modified: 2026-10-01T22:20:00+07:00
tags:
  - unistoria
  - licenses
---

# Third-Party Notices

Unistoria is distributed under the GNU General Public License, version 3 only (GPL-3.0-only).
See [LICENSE](LICENSE).

The distributed plugin files (`main.js`, `styles.css`) currently bundle no third-party packages.
Obsidian, Electron, and CodeMirror are provided by the host application and are not bundled.

## Adapted source

The embedded editor is adapted from **Unimian** (<https://github.com/parkisutama/obsidian-unimian>),
licensed GPL-3.0-only, copyright (C) 2026 Parkis Utama.
Adapted files keep their SPDX header and copyright line, and are listed here:

| File in this repository | Source file | Changes |
| --- | --- | --- |
| `src/platform/editor/embedded-editor.ts` | `src/platform/preview/detachedLeaf.ts` | The leaf's parent is the host view's window container (main window or popout); added `save()` and `close()` with active-leaf restore; removed the mobile branch |
| `src/styles/conversation.css` (composer editor header and hover-popover layer rules) | `src/styles/components/quick-preview-modal.css` | Re-scoped to `.unistoria-composer-editor`; raised specificity instead of `!important` |
