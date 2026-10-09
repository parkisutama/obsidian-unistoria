---
title: Native Acceptance Record
created: 2026-10-02T09:00:00+07:00
modified: 2026-10-08T10:00:00+07:00
tags:
  - unistoria
  - acceptance
  - qa
---

# Native acceptance record

What has been verified in a real Obsidian, how to repeat it, and what is still open.
Automated checks (`pnpm run check:ci`) do not prove native behaviour; this record does not claim more than it lists.

- **Environment of the runs below:** Obsidian desktop 1.14.3 (the spec baseline is 1.14.2), Windows, the maintainer's working vault
  with Obsidian Linter, a tab-management plugin, and native menus on.
- **Run date:** 2026-10-02.

## How to repeat the scripted checks

Open the plugin's vault in Obsidian with Unistoria enabled and the Obsidian CLI on `PATH`, then run:

```bash
pnpm run native -- <vault name> scripts/native/h1-rename-matrix.js
pnpm run native -- <vault name> scripts/native/h2-popout.js
pnpm run native -- <vault name> scripts/native/h3-accessibility.js
pnpm run native -- <vault name> scripts/native/h4-performance.js
pnpm run native -- <vault name> scripts/native/h5-editor-pane.js
pnpm run native -- <vault name> scripts/native/h6-markdown.js
pnpm run native -- <vault name> scripts/native/h7-excerpt.js
```

Each script creates fixtures under `_unistoria-test/` in that vault and moves the folder to the vault trash afterwards.
Use a vault you are willing to touch.
Menus are native in some vaults and cannot be driven from a script; the scripts avoid menus.

## Definition of done (spec §17)

| Item | Evidence | Status |
| --- | --- | --- |
| The plugin creates all initial folders, files, and properties from its UI | Create space and Create topic driven through the real modals; folder, Folder Note, `messages/`, and draft verified (Phase 2 and 3 runs) | Verified |
| A complete topic with nested replies is portable Markdown with relative links | Reply flow and the H1 matrix read the raw files; links resolve through Obsidian's metadata cache | Verified |
| Reply, Edit, draft, publish, remove, and restore work without losing data | Phase 3 run; unknown properties and the body survive status changes | Verified; see "Frontmatter formatting" below |
| Normal view hides removed content, files stay put; recovery view restores | Phase 3 run | Verified |
| File moves, renames, and broken links are handled visibly and safely | H1: 20 checks, updater on and bypassed, rename, move, delete | Verified for scripted API operations |
| Main-window authoring | Phase 3 run; H3 | Verified |
| Popout authoring and closing the window with the composer open | H2: editor mounts in the popout document, publishes, saves text typed before the window closed, and every embedded editor is detached | Verified |
| Native-editor fallback | The fallback button opens a file in an editor tab; the trigger (leaf creation failing) cannot be forced from outside | Not exercised |
| Accepted in a real Obsidian 1.14.2 vault | Runs were on 1.14.3 | **Open**: repeat on 1.14.2 |

## Hardening items

| Item | Result |
| --- | --- |
| H1 rename and move matrix | 20 of 20 checks pass. Relationships follow renames made through Obsidian's API; a rename that bypasses the updater leaves the reply as a visible orphan and never adopts the renamed file |
| H2 popout and lifecycle | 17 of 17 checks pass. Four embedded editors opened, four detached |
| Thread panel and quoted replies (ADR-008), run 2026-10-08 on the same environment | `h3-accessibility.js`, rewritten for the panel: 45 of 45 checks pass. The topic list holds its own show and hide button and becomes a 44 px rail (from 248 px); the title has its own line above the controls; the topic page lists only thread starters; the thread control exposes the reply count, `aria-expanded`, and `aria-controls`; the panel opens beside the page (460 px), lists replies at any depth as one flat list in time order, expands to the whole view and names its topic, and closes with focus returning to the thread control; a reply to a reply shows a quote of the message it answers and selecting it moves there; every reply has Reply and none has a thread; Reply on a thread starter creates a draft whose parent is that message, Reply on a reply one whose parent is that reply. `h4-performance.js`: 34 and 134 thread starters render in about 70 ms and 250 ms, a thread panel in about 110 to 330 ms. `h5-editor-pane.js`, `h6-markdown.js`, and `h7-excerpt.js` pass unchanged (H7's late-growth check was skipped because the window was hidden) |
| H3 accessibility (layout before ADR-008) | All checks pass: named controls, list and landmark structure, `aria-expanded` and `aria-controls` on thread toggles, live-region announcements, focus kept across re-renders, focus moved into the composer and returned to the opener |
| H4 performance | About 1.1 ms per message to render: 100 messages in about 105 ms, 400 in about 450 ms; index rebuild under 15 ms. Editing a draft does not re-render the thread |
| ADR-007 editor pane (`h5-editor-pane.js`) | 18 of 18 checks pass: the pane is a real leaf with an active editor, an editor command (toggle bold) works in it, publish and close save and remove the pane, closing the pane by hand closes the dock, and in a popout the pane opens in the popout window. H2 and H3 pin the embedded mode, which stays as an option |
| Rendered Markdown (`h6-markdown.js`) | 17 checks pass: callout, quote, and code render through Obsidian's renderer with the reading-view classes; the conversation is a centered column; internal links open relative to the message; hovering fires Page Preview's `hover-link` event with Unistoria registered as a hover source and the view as hover parent; tags open a search for the tag; checkboxes change one line of the message or the Folder Note, a stale click changes nothing, and checkboxes that cannot be mapped to the source (an embedded note with its own task) are read-only |
| Excerpts (`h7-excerpt.js`) | 15 checks pass: a long message is cut at 320 px with a Read more button that names its message and exposes `aria-expanded` and `aria-controls`; short and slightly-over-limit messages are shown in full; expanding, the choice surviving a re-render, focus staying on the button, and Show less all work; the long topic context is shortened the same way; the full text stays in the page for assistive technology |
| H5 conflicts | A status change aborts if the status changed since it was read; deleting or renaming the open draft closes or follows the composer; deleted files are never recreated |

## Targets (decision K-09)

- Render time stays linear in the number of shown messages; a 1,000-message topic is expected to render in about 1.2 s.
  Topics larger than that are not a v1 target; collapsing threads reduces the work.
- Every control reachable by keyboard has a name; focus is never lost to the page body after an action.

## Open items

- **Thread panel in other conditions (ADR-008):** the scripted run used one theme and a wide pane.
  The narrow-pane rule (the open thread covers the topic page below 680 px), a popout window (H2 was not repeated after the change),
  and the look of the rail, the header spacing, and the quote in other themes have not been checked.
- **Scripts and other Unistoria tabs:** the scripts select elements in the whole document, so a second open Unistoria tab makes
  H4, H5, and H6 read the wrong view and fail. Close other Unistoria tabs before running them.
- **Scroll and focus in a real session:** the scripts check structure and focus targets, not the felt experience of typing and tabbing.
  A keyboard-only walkthrough by a person is still needed.
- **Updater disabled in settings:** *Automatically update internal links* turned off, then renaming in the file explorer.
  The scripted equivalent (renaming without the updater) passes; the interface path is not driven.
- **Themes:** looked at with one theme (Baseline). Dark mode and other themes are not checked.
- **Native menus:** the more-actions menu was driven with native menus switched off; the native-menu path itself is not scripted.
- **1.14.2:** see the table above.
- **Late-loading content in excerpts:** text that grows after the first render (images, embeds) is re-measured by a ResizeObserver, which does not run while the Obsidian window is hidden; the script skips that check then and reports it as a note.
- **Page Preview popover:** a script cannot open it (Obsidian's own preview source does not react to a synthetic event either). By hand: hold Ctrl and hover an internal link in a message.
- **Embeds and other renderer features:** note embeds, math, Mermaid, and footnotes come from Obsidian's renderer and were looked at only for callouts, quotes, code, links, tags, and tasks.

## Frontmatter formatting by other plugins

In the test vault another plugin reformatted message files when they were opened in the editor:
it added `title` and `modified`, inserted a first heading with the file name, and shortened `created` to minute precision.
Unistoria preserved everything it was given, but the visible result is a heading on every message.
Exclude the space folders from such plugins.
Sibling order falls back to `message_id` when two messages share a minute; whether to use the filename stamp as a second key is an open decision (ADR-001).
