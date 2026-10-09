---
title: Architecture Decision Records
created: 2026-10-01T22:20:00+07:00
modified: 2026-10-08T10:00:00+07:00
tags:
  - unistoria
  - adr
---

# Architecture decision records

An ADR is required before changing the frontmatter schema, link format, lifecycle transitions, command IDs, view type, or settings keys.
Name files `ADR-NNN-<slug>.md`.
Status is Proposed, Accepted, or Superseded; supersede a decision instead of deleting it.

Each ADR records the context, the decision, the alternatives considered, the consequences, and the evidence.
Spike notes (`spike-*.md`) hold the raw evidence an ADR cites.

| ADR | Title | Status |
| --- | --- | --- |
| [ADR-001](ADR-001-schema-and-time.md) | Schema and time values | Accepted |
| [ADR-002](ADR-002-relationships-and-boundary.md) | Relationships and topic boundary | Accepted |
| [ADR-003](ADR-003-lifecycle.md) | Message lifecycle | Accepted |
| [ADR-004](ADR-004-creation-and-recovery.md) | Creation and recovery | Accepted |
| [ADR-005](ADR-005-mutation-and-preservation.md) | Mutation and preservation | Accepted |
| [ADR-006](ADR-006-embedded-editor.md) | Embedded editor | Accepted; superseded in part by ADR-007 |
| [ADR-007](ADR-007-editor-pane.md) | Editor pane for composing | Accepted |
| [ADR-008](ADR-008-thread-panel.md) | Thread panel and flat threads | Accepted |

| Spike | Subject |
| --- | --- |
| [S1](spike-s1-relative-links.md) | Relative Markdown links and the link updater |
| [S2](spike-s2-embedded-editor.md) | Embedded editor in main and popout windows |
| [S3](spike-s3-frontmatter-round-trip.md) | Frontmatter round trip |
