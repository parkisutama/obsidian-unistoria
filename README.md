---
title: Unistoria
created: 2026-10-01T22:20:00+07:00
modified: 2026-10-02T07:15:00+07:00
tags:
  - unistoria
  - readme
---

# Unistoria

Folder-scoped threaded conversations for Obsidian.
Every message and reply is its own Markdown file, linked to its topic and parent with portable relative Markdown links.
The vault stays the source of truth; Unistoria adds a conversation and writing interface on top.

**Status:** pre-release.
You can create a space and a topic, read it as a threaded conversation, write in Obsidian's own editor,
publish, reply, edit, and remove or restore messages.
Editing in a popout window and the final acceptance pass are still open.
See [the implementation plan](docs/implementation-plan.md) for progress.

- Desktop only, validated against Obsidian 1.14.2 and 1.14.3.
- License: GPL-3.0-only. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Using Unistoria

1. Run **Create space** and choose or type a folder. A space is an ordinary folder that will hold topics.
2. Run **Create topic**, pick the space, and give the topic a title.
   Unistoria creates the topic folder, a Folder Note with the same name, a `messages/` folder, and a first draft.
3. Write the draft in the editor pane that opens next to the conversation. It is Obsidian's normal editor, with all your plugins and hotkeys.
   Then choose **Publish** in the bar under the conversation. (Settings → Unistoria → Editor can embed the editor below the conversation instead.)
4. The topic page lists the messages that start a thread. Use **Reply** on one, or its thread control
   (the reply count, or **Open thread**), to read it with its replies in a panel on the right.
   The panel can be expanded to the whole view for focused reading, and closed again.
   A reply is a new file whose `parent` links to the message it answers. You can also **Reply** to a reply:
   it stays in the same flat list, with a one-line quote of the message it answers that jumps there when selected.
   Replies do not start threads of their own.
   **Edit** changes a published message in place; **Remove** hides a message and everything below it without deleting any file, and **Restore and publish** brings it back.
5. Drafts you close stay under **Drafts** and can be opened again. A draft is unpublished, not private.
6. Messages are rendered like reading view: callouts, quotes, code, embeds, and math work.
   Links open (hold Ctrl for a new tab), hovering a link with Ctrl previews it, clicking a tag searches for it, and you can tick task checkboxes in a message or the topic context.
7. Long messages and long topic context show an excerpt with a **Read more** button (and **Show less**).
   The cut is by height, not by character count, so lists, callouts, and images are handled alike, and your choice is kept while you work.
8. **Show removed and unpublished** reveals hidden messages for recovery. The data problems panel lists broken links, missing parents, and duplicate ids, each with an Open file link.

Open the topic list with the **Open topics** command or the ribbon icon.
Everything is a Markdown file you can read, move, and edit without the plugin.

## Compatibility notes

- Other plugins can change message files.
  Formatters such as Obsidian Linter may add a `title` property and a first heading,
  and may shorten timestamps, when a message opens in the editor.
  Exclude your space folders from such plugins' rules.
- Unistoria keeps other properties on status changes, but Obsidian's frontmatter API may rewrite YAML comments
  and list or quote style (see [ADR-005](docs/decisions/ADR-005-mutation-and-preservation.md)).
- Titles and filenames cannot contain `#`, `^`, `[`, `]`, or `|`; those characters are removed when a topic is created.

## Documentation

- [Product specification](docs/unistoria-spec.md)
- [Specification evaluation](docs/unistoria-spec-evaluation.md)
- [Implementation plan](docs/implementation-plan.md)
- [Architecture decisions](docs/decisions/README.md)
- [Contributing](CONTRIBUTING.md)
