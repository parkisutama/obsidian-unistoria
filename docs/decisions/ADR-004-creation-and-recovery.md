---
title: ADR-004 Creation and recovery
created: 2026-10-02T00:20:00+07:00
modified: 2026-10-02T00:20:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-004 Creation and recovery

- **Status:** Accepted (maintainer, 2026-10-02)
- **Date:** 2026-10-02
- **Evidence:** spec §9.1; decision K-03 in the [plan](../implementation-plan.md)

## Context

Creating a topic writes several files and can fail part-way.
The spec asks for "one operation", no partial structures, and recoverable failures at once.

## Decision

- The operation is an ordered list of steps: topic folder, Folder Note, `messages/`, first draft.
  It is not atomic; the spec wording is read as "never leave an unreadable state, never overwrite".
- Every intermediate state is valid: a folder without a Folder Note is not a topic;
  a topic without a message offers "start the first message".
- Existing paths are never overwritten. A conflict stops the operation and is explained before anything is written.
- A retry skips steps that already exist with a matching `topic_id`.
- On failure the user sees what was created.
  Cleanup is offered only for files this operation created and whose content is unchanged.
- No journal or other non-Markdown state is stored in the vault.

## Alternatives considered

- A write-ahead journal file: adds a second store, against the "vault is the source" principle.
- Rolling back automatically: risks deleting content the user already edited.

## Consequences

- Failure injection is part of the F7 tests. A crash between steps leaves a state the index already understands.
