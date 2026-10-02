---
title: Spike S3 — Frontmatter round trip
created: 2026-10-01T23:50:00+07:00
modified: 2026-10-01T23:50:00+07:00
tags:
  - unistoria
  - spike
  - evidence
---

# Spike S3 — Frontmatter round trip

Evidence for ADR-001 (schema and time), ADR-005 (mutation and preservation), and tasks F1 and F8.
It answers R-03 and R-08 from the [specification evaluation](../unistoria-spec-evaluation.md).

## Setup

- Obsidian desktop `1.14.3`, the maintainer's working vault. Method as in [spike S1](spike-s1-relative-links.md):
  scripts through `obsidian eval`, temporary folder moved to the vault trash afterwards.
- Each fixture was a message file with the schema from spec §7.5.
  `FileManager.processFrontMatter` set `status: published` and a new `updated`, and the file text was compared before and after.

## Findings

### 1. What `processFrontMatter` preserves

| Item | Result |
| --- | --- |
| Body text, blank lines, trailing spaces in the body | Preserved exactly |
| Key order | Preserved |
| Quoted link values such as `"[Topic Name](../Topic%20Name.md)"` | Preserved, quotes included |
| Unknown keys, nested maps, lists | Preserved as data |
| Quoted string containing a colon and a hash sign | Preserved, still quoted |
| Block scalar (pipe style) | Preserved |
| Non-ASCII text and emoji | Preserved |
| CRLF line endings | Preserved |
| Seconds-precision datetime string | Preserved as text, not reformatted |

### 2. What it normalizes

| Item | Result |
| --- | --- |
| YAML comments (`# note`) in the frontmatter | **Dropped** |
| Flow lists (`[One, Two]`, `y: [1, 2]`) | Rewritten as block lists |
| Single-quoted strings (`'it''s'`) | Rewritten without quotes when safe (`it's`) |

The preservation contract (K-05) is therefore **semantic, not byte-for-byte**:
values, key order, and the body survive; YAML comments and the flow/quote style of unknown keys may change.
Specification §9.3 and the user documentation must say so.
The plugin never rewrites frontmatter except through `processFrontMatter`, and only for the keys listed in spec §7.5.

### 3. The Properties UI accepts seconds-precision datetimes

Opening a note with `created: 2026-10-01T10:30:00` shows a `datetime-local` widget.
The Properties input displays minutes (`2026-10-01T10:30`) when the seconds are zero.
In this vault `created` was already assigned the Date & time type, so the result also shows that the widget accepts the seconds form.
Link properties render as links (`metadata-link`).

Decision: keep `YYYY-MM-DDTHH:mm:ss` (spec §7.6).
Risk to note: a user who edits a timestamp in the Properties UI may rewrite it with minute precision;
sibling ordering then falls back to `message_id` for equal values, which stays deterministic.

## Not covered

- The Date & time type for a vault where `created`/`updated` are not yet assigned a type (type inference for new vaults).
- Concurrent edits while `processFrontMatter` runs (task H5).
- Very large frontmatter and files edited externally while open in an editor.
