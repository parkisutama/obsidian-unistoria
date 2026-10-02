---
title: ADR-002 Relationships and topic boundary
created: 2026-10-02T00:20:00+07:00
modified: 2026-10-02T00:20:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-002 Relationships and topic boundary

- **Status:** Accepted (maintainer, 2026-10-02)
- **Date:** 2026-10-02
- **Evidence:** [S1](spike-s1-relative-links.md); decision K-04 in the [plan](../implementation-plan.md)

## Context

`topic` and `parent` are Markdown links in YAML properties.
Obsidian's updater rewrites them in its own style, and some filename characters cannot be linked.

## Decision

- **Writing:** a complete Markdown link with a source-relative `.md` destination.
  Percent-encode `%` as `%25` and space as `%20`; write every other character raw.
- **Reading:** decode the destination once with `decodeURIComponent` (raw text on failure), then normalize against the source file.
  Accept a missing `./`, raw or encoded non-ASCII, and any link text. Resolution never uses the link text or the filename.
- **Membership:** a message belongs to the topic whose `messages/` folder contains it.
  The `topic` link must resolve to a note in the parent folder of `messages/`; a basename different from the folder is reported as information.
  `parent` must resolve to a message in the same `messages/` folder.
- **Failure states:** a missing target, a self-parent, a cycle, a target outside the topic, or a duplicate `message_id`/`topic_id`
  produces a visible integrity state. A relationship is never re-attached to another message.
- **Filenames:** titles and filenames must not contain `#` (it cannot be linked). `^`, `[`, `]`, and `|` are removed as well.
  The resulting path is shown before creation.
- The plugin mutates only files inside the open topic's folder, regardless of what a link points to.

## Alternatives considered

- `encodeURIComponent` for the whole destination: breaks `& + , ; = @ $` in Obsidian.
- Angle-bracket destinations: fail for names containing `%20`-like text.
- Wikilinks or plain paths: excluded by the spec.

## Consequences

- With the updater disabled or bypassed, links go stale and are reported; they are not guessed.
- Rename and move behaviour through the file explorer, with the setting off, is still manual QA (task H1).
