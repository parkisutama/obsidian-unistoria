---
title: Unistoria Product Specification
created: 2026-10-01T21:45:05+07:00
modified: 2026-10-02T00:30:00+07:00
tags:
  - unistoria
  - product-specification
---

# Unistoria — Product Specification

- **Status:** Draft for implementation planning
- **Date:** 2026-10-01
- **Product form:** Obsidian community plugin
- **Platform:** Desktop only (`isDesktopOnly: true`)
- **Desktop validation baseline:** Obsidian 1.14.2
- **Plugin name:** Unistoria
- **Plugin ID:** `unistoria`
- **License direction:** GPL-3.0-only for reuse/adaptation of Unimian code
- **Name rationale:** Inspired by Latin *historia*—history and story.

## Handoff note

This specification is the product and implementation handoff for a separate implementation session. Treat the requirements and acceptance criteria below as the approved direction; resolve only the listed implementation decisions without changing the agreed storage model or lifecycle.

## 1. Summary

Build **Unistoria**, an Obsidian plugin for folder-scoped conversations inspired by Google Chat Spaces and GitHub Issue discussions. A user creates a Space and starts a conversation from the plugin; the plugin immediately creates the topic folder, its Folder Note, and the first message file with required Markdown properties. Each subsequent message and reply is also an independent Markdown file. The plugin renders those files as an interactive threaded conversation and uses portable relative Markdown links to represent relationships.

The vault remains the source of truth. The plugin adds a comfortable conversation and writing UI without requiring an initial vault setup, query engine, database, or non-Markdown message store.

## 2. Problem

Plain Markdown can store discussion, but manually creating files and maintaining a nested list of replies is cumbersome. Query-based views introduce a separate authoring and maintenance model. Users need a chat-like conversation UI while preserving readable, portable Markdown files and a folder boundary that agents can use as a knowledge context.

## 3. Goals

1. Start a usable Space and first conversation from the plugin without manually preparing folders, templates, or properties.
2. Create one Markdown file for every message and reply, with portable relative Markdown links for topic and parent relationships.
3. Make replying to a specific message and reading nested replies feel like Google Chat Spaces threads.
4. Keep message content human-readable and editable as normal Markdown.
5. Use the containing topic folder as a clear context boundary for people and future agents.

## 4. Non-goals for v1

- Mobile support and mobile authoring acceptance.
- Real-time multi-user synchronization, presence, or remote collaboration service.
- Reactions, attachments, mentions/notifications, assignment workflows, and GitHub issue parity beyond basic topic metadata.
- Query/Bases/Dataview dependency.
- A plugin-owned database or serialized message format.
- Automatically generating or editing agent instruction files. The folder structure should make such workflows possible, but agent integration is separate.
- Hard deletion or moving removed messages to Obsidian Trash.

## 5. Terminology

- **Space:** A user-selected parent folder containing related topics.
- **Topic / Issue:** One discussion context represented by a folder and a Folder Note. “Issue” is a possible UI label; the model is not limited to bug reports.
- **Message:** One Markdown file in a topic's `messages/` folder.
- **Reply thread:** A message plus its direct and nested replies. Replies do not create new topic folders.
- **Folder Note:** The Markdown note with the same basename as its topic folder; it stores topic metadata and acts as the conversation entry point.

## 6. User stories

- As a vault user, I can create a Space and immediately start a conversation without a setup wizard.
- As a participant, I can reply to a particular message and see the reply nested in that message's thread.
- As a writer, I can compose and edit a message in a comfortable Obsidian Markdown editing surface.
- As a vault maintainer, I can inspect, move, link, and edit every message using ordinary Markdown files.
- As an agent, I can treat one topic folder as the bounded knowledge context for a discussion.

## 7. Data model and on-disk layout

### 7.1 Layout

```text
<configured-space-root>/
  <topic-folder>/
    <topic-folder>.md             # Folder Note and topic metadata
    messages/
      2026-10-01T103000-<id>.md
      2026-10-01T104500-<id>.md
```

The plugin owns creation of this structure. The Space root is selected or created by the user as part of the **Create Space** flow. Creating a topic inside an existing Space immediately creates its folder, Folder Note, `messages/` folder, and initial message draft. There is no separate “install/setup vault structure” phase.

### 7.2 Topic Folder Note

The Folder Note is the stable entry point for the discussion. It contains topic properties and an optional human-written context/description. It does not duplicate the complete message bodies.

Example:

```markdown
---
type: discussion-topic
topic_id: topic-<stable-id>
status: open
created: 2026-10-01T10:30:00
updated: 2026-10-01T10:45:00
---
```

### 7.3 Message file

Each message is one Markdown file. YAML properties contain stable identity, status, timestamps, and relative Markdown links. The body after frontmatter is the message content, written as ordinary Markdown.

Example root message:

```markdown
---
type: discussion-message
message_id: msg-<stable-id>
topic: "[Topic Name](../Topic%20Name.md)"
parent: ""
status: draft
created: 2026-10-01T10:30:00
updated: 2026-10-01T10:30:00
author: ""
---

Message body in ordinary Markdown.
```

For a message stored at `Topic Name/messages/2026-10-01T104500-def456.md`,
the topic link above resolves to `Topic Name/Topic Name.md`.
The Folder Note is one directory above `messages/`; do not repeat the topic folder in the destination.

Example reply properties pointing to a parent in the same `messages/` directory:

```yaml
topic: "[Topic Name](../Topic%20Name.md)"
parent: "[Parent message](./2026-10-01T103000-abc123.md)"
```

`topic` and non-empty `parent` are YAML text values containing a complete Markdown link,
with a source-relative, URL-encoded `.md` destination.
Plain path strings, Obsidian wikilinks, and vault-absolute destinations are not generated.
A root message uses `parent: ""`.

[Obsidian 1.11 Desktop release notes](https://obsidian.md/changelog/2026-01-12-desktop-v1.11.4/)
confirm Markdown links in text/list properties and automatic updates when the destination file is moved or renamed.
The desktop validation baseline is Obsidian 1.14.2.
Validate the concrete relative-link fixtures and updater behavior in a real vault,
including the automatic-link-update setting being disabled; report broken references visibly when links remain stale.

### 7.4 Identity and filenames

- Filenames include a sortable timestamp and collision-resistant stable suffix; identity is also stored in `message_id`.
- Renaming a file does not change its identity.
- Relationships are resolved from relative Markdown link properties, not inferred from filenames.
- Link destinations percent-encode only `%` (as `%25`) and space (as `%20`); every other character, including non-ASCII, is written raw.
  Full `encodeURIComponent` is not used: in Obsidian 1.14.3 it breaks links to names containing `& + , ; = @ $`.
  A reader decodes a destination once and accepts both raw and percent-encoded non-ASCII, a missing `./`, and any link text, because Obsidian's updater rewrites links in its own style.
- `#` cannot be linked in any form, so titles and filenames must not contain it. Sanitization also removes `^`, `[`, `]`, and `|`.
  See [ADR-002](decisions/ADR-002-relationships-and-boundary.md) and [spike S1](decisions/spike-s1-relative-links.md).

### 7.5 Property schema

Topic Folder Note properties:

| Property | Required | Type | Rule |
| --- | --- | --- | --- |
| `type` | yes | text | Exactly `discussion-topic` |
| `topic_id` | yes | text | `topic-<stable-id>`; unique in the vault; never changed after creation |
| `status` | yes | text | `open` or `closed`; new topics start `open` |
| `created` | yes | date & time | Set once at creation; never changed |
| `updated` | yes | date & time | Set by the plugin on every change it makes to the note |

Message properties:

| Property | Required | Type | Rule |
| --- | --- | --- | --- |
| `type` | yes | text | Exactly `discussion-message` |
| `message_id` | yes | text | `msg-<stable-id>`; unique in the vault; never changed after creation |
| `topic` | yes | text | Complete Markdown link to the topic's Folder Note (§7.3) |
| `parent` | yes | text | `""` for a root message; otherwise a complete Markdown link to a message in the same `messages/` folder |
| `status` | yes | text | `draft`, `published`, or `removed` (§8) |
| `created` | yes | date & time | Set once at creation; never changed |
| `updated` | yes | date & time | Set by the plugin on every change it makes to the file |
| `author` | no | text | Optional, user-entered; written as `""` when unset (§13) |

Rules for every generated file:

- The plugin writes only the properties listed above. Any other property is preserved as is and never interpreted.
- A missing required property, a wrong type, or a `status`/`type` value outside the lists above makes the file invalid.
  An invalid file is reported (§11), is never published or edited by the plugin, and is never silently repaired.
  Its source file stays openable.
- The plugin never rewrites a value it does not recognize, including a `status` written by a newer version.

### 7.6 Time values

- `created` and `updated` are local wall-clock time without a UTC offset, formatted `YYYY-MM-DDTHH:mm:ss`.
  Obsidian does not support multiple time zones, so no offset is written or required.
- Values are not comparable across machines in different time zones. The plugin makes no such guarantee.
- A value that does not parse as a date and time is invalid. The file is shown with an integrity warning, sorted after valid siblings, and not repaired.
- Sibling messages are ordered by `created`, then by `message_id` as a deterministic tie-breaker. Manual reordering is out of scope.
- The timestamp in a filename is informational. Ordering and display never read it.

## 8. Message lifecycle

Allowed message statuses:

- `draft`: unpublished and not shown in the conversation; remains a Markdown file. It is not private: v1 has no identity or access boundary, so any local user of the vault can open it.
- `published`: visible in the conversation and eligible for replies.
- `removed`: hidden from the normal conversation UI; file remains in place and is not sent to Trash.

Allowed transitions, each an explicit user action that changes only `status` and `updated`:

| From | To | Condition |
| --- | --- | --- |
| `draft` | `published` | The body is not empty |
| `published` | `removed` | None |
| `removed` | `published` | None; restoring always returns to `published` |

No other transition exists in v1. A `draft` cannot be removed; discarding it means leaving it unpublished.
A reply can be created only from a `published` message.

Visibility in the normal conversation:

- A message is shown only when it is `published` and every ancestor is `published`.
- A `published` message below a `draft` or `removed` ancestor stays stored and is hidden with that ancestor's subtree.
- The reveal/recovery view shows hidden content and marks the status of each message.

`removed` is a soft visibility state, not deletion. Its descendants remain stored. The regular conversation hides the removed message and its subtree so a reply is not shown without its context. The UI offers an explicit way to reveal removed content for recovery/audit; publishing or restoring a removed message is an explicit user action. No automatic file move or content erasure occurs.

The first message created with a new topic is a draft, opened in the composer so the user can write and publish it. If the user cancels the composer, keep the draft file and topic structure; provide a visible draft entry so the content is recoverable.

## 9. Core UX

### 9.1 Space and topic creation

1. User invokes **Create Space** from a command, ribbon action, or plugin view.
2. User chooses an existing folder or creates a named Space folder.
3. User selects **New Topic** and enters a title (and optionally a short context/description).
4. Plugin creates the topic folder, matching Folder Note, `messages/` subfolder, and first draft message file in one operation.
5. Plugin opens the topic conversation and focuses the message composer/editor.
6. User writes Markdown and chooses **Publish**. Publishing updates the file's status property to `published`.

Creation must be recoverable and avoid partial structures. On failure, report which files were created and offer retry/cleanup; never silently overwrite an existing folder or note.

### 9.2 Conversation UI

- Space/topic navigation shows topics and their open/closed state. Browsing is required for the first release so a topic can be reopened later.
- `closed` is a label in v1: it does not block replying, editing, or publishing, and it does not move any file.
- Main pane displays the topic title/context and a chronological conversation.
- Messages render Markdown using Obsidian's Markdown rendering so standard Markdown and supported Obsidian embeds/links behave consistently where feasible.
- Each published message has **Reply** and **Edit** as the primary actions in v1. Message lifecycle controls may be in a secondary menu.
- A message with replies shows an inline thread preview/count and can expand/collapse its reply subtree.
- Replies are visually nested under their parent, with clear author/time metadata.
- A composer opens for a new topic message or as a reply composer anchored to the selected parent.
- Editing reuses/adapts the Quick Preview editing experience from `parkisutama/obsidian-unimian` under GPL-3.0-only, preserving copyright, license notices, and attribution for adapted source/helpers/styles. Prefer Obsidian's native Markdown editing behavior over a custom rich-text editor.
- The plugin targets desktop only. Validate the editor in the main window and desktop popout windows; if detached-leaf embedding is unavailable, provide an explicit action opening the file in a normal native Markdown editor. Editing adapted code does not remove its GPL obligations.

### 9.3 Rendering and storage

- The Markdown file is canonical; the rendered message card is a view of its frontmatter and body.
- Editing changes the message file in place and preserves unknown frontmatter fields and body content outside the user's edits.
  Preservation is semantic: values, key order, and the body survive a status change, but YAML comments, flow-style lists, and quote style in the frontmatter may be rewritten by Obsidian's frontmatter API ([ADR-005](decisions/ADR-005-mutation-and-preservation.md)).
- Publishing, removing, or restoring changes only the status property plus the appropriate updated timestamp.
- Never store canonical message content only in plugin settings, cache, or a database.
- External edits and Obsidian file rename/move events must be reflected in the view. Relative links should benefit from Obsidian's internal-link updater when available; plugin resolution must still validate links and surface broken relationships.

## 10. Requirements and acceptance criteria

### P0 — Create structure and first draft automatically

- Given a valid Space root and a new topic title, when the user creates the topic, then the plugin creates its folder, same-name Folder Note, `messages/` folder, and first message Markdown file with all required properties.
- Given a title that maps to an existing path, when creation is attempted, then the plugin does not overwrite files and explains the conflict.
- Given a write failure during creation, when the operation stops, then the user sees a clear error and can identify/recover any partial files.
- Given the first draft is created, then it opens in the composer and remains discoverable if the composer is dismissed.

### P0 — Markdown files and portable relationships

- Every message/reply is its own `.md` file with frontmatter and normal Markdown body.
- Topic and non-empty parent properties contain complete Markdown links with source-relative, URL-encoded `.md` destinations; no wikilinks or plain path strings are generated.
- Given the example message in `Topic Name/messages/`, then `[Topic Name](../Topic%20Name.md)` resolves to `Topic Name/Topic Name.md`.
- Given automatic internal-link updates are enabled on the desktop validation baseline, when a linked destination is renamed/moved, then the property link remains navigable and the conversation resolves the intended relationship. With updates disabled, stale references are reported visibly without guessing a target.
- Given a reply is created from a message, then its `parent` points to that message and the topic link points to the Folder Note.
- Given a message file is renamed/moved within Obsidian, then the UI reconciles the updated path/link or reports a broken reference without silently attaching it to another message.
- A user can open and understand message files without the plugin enabled.

### P0 — Threaded conversation and writing

- Given a published message, when the user selects Reply, then a draft reply is created with the correct parent and topic links and appears in that message's thread after publish.
- Nested replies render under their direct parent and can be expanded/collapsed without creating topic folders.
- Message body is composed and edited as Markdown, and rendered with Obsidian Markdown behavior.
- Primary per-message actions are Reply and Edit.

### P0 — Lifecycle

- A draft is excluded from the normal published conversation and remains accessible in a drafts view/state.
- Publishing changes the message to visible `published` state.
- Removing a published message sets `status: removed`; its file remains at the same path and is not moved to Trash.
- Removed messages and descendants are hidden in normal view; an explicit reveal/recovery path can inspect them and restore/publish them.
- Only the transitions in §8 are possible. Given an empty body, when the user publishes a draft, then publishing is refused and the status is unchanged.
- Given a status change, then only `status` and `updated` change in the file; every other property and the body are unchanged.
- Given a `published` message under a `removed` or `draft` ancestor, then it is hidden in normal view and visible, with its status marked, in the reveal view.

### P1 — Topic navigation and metadata

- Users can browse topics within a Space and open a topic from the plugin view.
- Topic context/description is editable in the Folder Note.
- Topic open/closed state is visible and can be changed without changing message files' locations.

## 11. Error and edge cases

- Missing, malformed, duplicate, or cyclic parent links must not crash rendering. Show an orphan/invalid relationship state and allow the user to open the source file.
- Missing topic links or a moved Folder Note must be reported; never guess a different parent.
- Duplicate message IDs are surfaced as a data integrity issue.
- Unknown frontmatter properties and arbitrary Markdown must be preserved during status updates and edits.
- Empty message bodies cannot be published; drafts may be empty while being composed.
- A file with missing required properties, wrong types, an unknown `type` or `status`, or an unparsable `created`/`updated` is shown as invalid with its problem named and an action to open the source file. The plugin does not modify it.
- A file whose frontmatter cannot be parsed as YAML is treated the same way and is never rewritten.
- When Obsidian's metadata cache has not yet indexed a file, the plugin does not render a partial hierarchy; it waits for the cache or reads the file directly.
- Deleted files disappear from the view after Obsidian vault events; plugin does not recreate them automatically.
- If the plugin is disabled, all content and relationships remain inspectable as Markdown.

## 12. Settings and commands

Minimum v1 entry points:

- `Create Space`
- `Create Topic`
- `Open Space / Topic view`
- Ribbon or view action for new topic

Minimal settings:

- Optional default Space root; unset is valid and prompts for the folder when creating the first Space.
- Filename/title sanitization behavior should be predictable and show the resulting path before creation if transformed.
- No mandatory template configuration or schema setup.

## 13. Privacy and collaboration boundary

V1 is local-vault file management. `author` is optional/user-entered unless a reliable local identity source is explicitly selected. The plugin must not imply authenticated identity, remote synchronization, or conflict-free concurrent editing. Obsidian Sync/Git/external sync are outside plugin guarantees; concurrent edits should preserve files and surface conflicts rather than silently overwrite when detectable.

## 14. Success measures

For a usability review, measure:

- A new user can create a Space, topic, and first published message without manual file/property setup.
- A user can create a reply to the intended parent and correctly identify its parent in the UI and raw Markdown.
- The rendered conversation and raw Markdown agree on message content, status, and hierarchy.
- Moving/renaming files through Obsidian does not silently corrupt or misassign conversation relationships.
- Removing/restoring a message never moves or erases its file.

Targets should be set after a first prototype walkthrough; no telemetry is required for v1.

## 15. Phasing

1. **Foundation:** schema, path/link utilities, automatic Space/topic/message creation, lifecycle mutations, and file-event reconciliation.
2. **Conversation MVP:** topic view, Markdown rendering, nested replies, draft/publish, Reply/Edit, Quick Preview based editing.
3. **Hardening:** move/rename/recovery cases, desktop main-window/popout editing, accessibility, large-thread performance, and real-vault acceptance.

## 16. Open implementation decisions

These do not change the agreed product direction but should be resolved during technical design:

- Path escaping/encoding edge cases and reconciliation when the native updater is disabled or cannot update a relationship; the canonical property syntax is the complete relative Markdown link defined in §7.3.
- Resolved for v1: a Space is a plain folder with topic folders beneath it and no Space note.
- Resolved for v1: drafts are visible to every local vault user; the UI describes them as unpublished, never private (§8).
- To validate against real Obsidian 1.14.2: that `YYYY-MM-DDTHH:mm:ss` is shown and edited as a Date & time property (§7.6). If it is not, fall back to minute precision `YYYY-MM-DDTHH:mm` and keep `message_id` as the tie-breaker.
- The smallest Quick Preview source/helper/style subset to reuse or adapt under GPL-3.0-only, with preserved attribution, lifecycle cleanup, and a desktop native-editor fallback for undocumented API changes.
- Resolved for v1: siblings are ordered by `created`, then `message_id` (§7.6); manual reorder is out of scope.

## 17. Definition of done

- The plugin creates all initial folders/files/properties from its UI with no user-prepared schema.
- A complete topic conversation, including nested replies, is represented by portable Markdown files and relative Markdown links.
- Reply, Edit, draft, publish, remove, and restore work without losing Markdown/frontmatter data.
- Normal view hides removed content while files remain untouched; recovery view can reveal and restore it.
- File moves/renames and broken links are handled visibly and safely.
- Desktop authoring in the main window and popout windows, including the native-editor fallback, is accepted in a real Obsidian 1.14.2 vault; automated validation alone is not considered native UI acceptance.
