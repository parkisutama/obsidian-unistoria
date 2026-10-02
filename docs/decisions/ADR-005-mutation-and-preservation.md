---
title: ADR-005 Mutation and preservation
created: 2026-10-02T00:20:00+07:00
modified: 2026-10-02T00:20:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-005 Mutation and preservation

- **Status:** Accepted (maintainer, 2026-10-02)
- **Date:** 2026-10-02
- **Evidence:** [S3](spike-s3-frontmatter-round-trip.md); decision K-05 in the [plan](../implementation-plan.md)

## Context

The spec requires unknown fields and Markdown to be preserved.
`processFrontMatter` preserves values but not YAML formatting.

## Decision

- Frontmatter changes go through `FileManager.processFrontMatter` only, from `src/platform/vault`,
  and touch only the keys in spec §7.5.
- Preservation means semantic equality: values, key order, and the body survive.
  YAML comments, flow-style lists, and quote style may change. This is stated in the spec and user documentation.
- Body edits happen only through Obsidian's own editor.
- A file with unparsable YAML or an invalid schema is shown as invalid, offered "open file", and never mutated.
- If the metadata cache has not indexed a file, the plugin reads and parses the file itself rather than showing a partial hierarchy.

## Amendment (2026-10-02): task checkboxes

Obsidian's reading view lets a reader tick a task checkbox, which edits the note. The conversation renders messages
with the same renderer, so the same interaction is supported, as the one exception to "body edits happen only through
Obsidian's own editor":

- Only a single marker character in a task list item changes (`[ ]` to `[x]` and back), through `vault.process`,
  and only in a message of the open topic or its Folder Note.
- Obsidian gives checkboxes no source line, so a checkbox is matched to its source by order. The toggle is applied only
  when the number of rendered checkboxes equals the number of tasks in the source (outside code fences) and the source still
  has the state the reader clicked on; otherwise the checkboxes are read-only or the click is refused. A stale click never
  changes another line.
- Nothing else in the body is rewritten, and the frontmatter is untouched.

## Alternatives considered

- Rewriting the file text directly to keep every byte: higher risk, and it duplicates a tested API.

## Consequences

- A user who annotates frontmatter with YAML comments loses them on the next status change. This is documented, not hidden.
