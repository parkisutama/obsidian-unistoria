---
title: ADR-001 Schema and time values
created: 2026-10-02T00:20:00+07:00
modified: 2026-10-02T00:20:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-001 Schema and time values

- **Status:** Accepted (maintainer, 2026-10-02)
- **Date:** 2026-10-02
- **Evidence:** [S3](spike-s3-frontmatter-round-trip.md); decisions K-01 and R-11 in the [plan](../implementation-plan.md)

## Context

Spec §7.2–7.3 gave examples but no required/optional/type contract, and timestamps had no time zone rule.
Obsidian does not support multiple time zones.

## Decision

- The property schema is the tables in spec §7.5. Unknown properties are preserved and never interpreted.
  A file that violates the schema is invalid: reported, never edited or repaired.
- `created` and `updated` are local wall-clock time without an offset, `YYYY-MM-DDTHH:mm:ss` (spec §7.6).
- Siblings sort by `created`, then `message_id`. Filename timestamps are informational only.
- Identifiers are `topic-<id>` and `msg-<id>`, generated from `crypto.getRandomValues`, immutable.

## Alternatives considered

- Offset-bearing instants: rejected by the maintainer, because Obsidian has no multi-time-zone support.
- Minute precision: kept only as a fallback; same-minute messages would depend on `message_id` order.

## Consequences

- Ordering across machines in different time zones is not guaranteed, and the spec says so.
- A user editing a timestamp in the Properties UI may reduce it to minute precision; ordering stays deterministic through `message_id`.
- Any change to the schema or the time format requires a new ADR.
