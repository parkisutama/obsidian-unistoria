---
title: ADR-003 Message lifecycle
created: 2026-10-02T00:20:00+07:00
modified: 2026-10-02T00:20:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-003 Message lifecycle

- **Status:** Accepted (maintainer, 2026-10-02)
- **Date:** 2026-10-02
- **Evidence:** spec §8; decision K-02 in the [plan](../implementation-plan.md)

## Context

The spec defined three statuses but not which transitions are allowed, or how a removed or unpublished ancestor affects descendants.

## Decision

- Transitions: `draft → published` (non-empty body), `published → removed`, `removed → published`. Nothing else in v1.
- Each transition writes only `status` and `updated`.
- A message is visible in the normal view only when it and every ancestor are `published`. A reveal view shows the rest, with status marked.
- Replies can only be created from `published` messages.
- Drafts are described as "unpublished"; v1 has no identity or access boundary.
- `closed` on a topic is a label and does not restrict authoring.

## Alternatives considered

- Allowing `draft → removed`: rejected, a draft is simply left unpublished.
- Restoring to the previous status: rejected, it would require storing history in the file.

## Consequences

- Removal never moves, trashes, or erases a file. Restore is always `published`.
