---
title: Spike S1 — Relative Markdown links and the link updater
created: 2026-10-01T23:30:00+07:00
modified: 2026-10-01T23:30:00+07:00
tags:
  - unistoria
  - spike
  - evidence
---

# Spike S1 — Relative Markdown links and the link updater

Evidence for ADR-002 (relationship and boundary) and for task F2 (`core/links`).
It answers R-02 and R-07 from the [specification evaluation](../unistoria-spec-evaluation.md).

## Setup

- Obsidian desktop `1.14.3` (the installed version; the spec baseline is 1.14.2), the maintainer's working vault.
- Link settings in that vault: `useMarkdownLinks: true`, `newLinkFormat: relative`, `alwaysUpdateLinks: true`.
- Method: scripts run through `obsidian eval`, creating fixtures in a temporary folder (`_unistoria-spike/`) and moving it to the vault trash afterwards.
  The only setting touched, `alwaysUpdateLinks`, was restored to `true`.
- Each fixture was a Folder Note, a root message, and a reply with `topic` and `parent` Markdown links in YAML properties,
  plus an unknown key (`extra_key`).
- Metadata cache state was read after a short wait: `frontmatterLinks`, `resolvedLinks`, and `unresolvedLinks`.

## Findings

### 1. Markdown links in properties resolve and are tracked

`metadataCache.frontmatterLinks` lists both links, and `resolvedLinks` resolves them.
Source-relative destinations with and without a leading `./` both resolve.

### 2. The updater rewrites links on rename and move, in its own style

Using `fileManager.renameFile` (the same code path as renaming in the file explorer),
across names with spaces, non-ASCII characters, and a name containing `%`:

| Operation | Result |
| --- | --- |
| Rename the parent message | `parent` updated to `root-renamed.md` (the `./` prefix is dropped; the link text is kept) |
| Rename the Folder Note | `topic` updated to the new file; the **link text is replaced** with the new basename |
| Rename the topic folder | Links unchanged and still resolving, because they are relative |
| Move the reply to another folder | The reply's own links are rewritten, for example `../Topic%20Name/messages/root.md` |
| Move the parent to another folder | `parent` rewritten, for example `../../other/root.md` |

Consequences:

- A reader must not expect the form the plugin wrote. `./` may disappear, link text may change, and a moved message gets `../<folder>/...` paths.
  The reader resolves the destination against the source file and ignores link text.
- Non-ASCII characters are rewritten **raw** by the updater (`T%C3%B3pik` becomes `Tópik`) while a hand-encoded link stays percent-encoded.
  Both resolve, so the reader accepts both forms.
- After a Folder Note rename, the topic link no longer points to a file named like the folder.
  The plugin must treat "link resolves to a note in the parent folder of `messages/`" as the topic relationship
  and report a basename mismatch as information, not as a broken link.

### 3. With the updater unavailable, nothing is guessed

`vault.rename` (no link update) leaves the property untouched and Obsidian lists the target under `unresolvedLinks`.
The relationship is therefore detectably broken, with no silent re-pairing.
This is the case the plugin must report visibly (spec §9.3, §11).

### 4. The `alwaysUpdateLinks` setting is not exercised by the API

With the setting forced to `false`, `fileManager.renameFile` still updated links.
The setting governs user-initiated renames in the interface, so it cannot be tested from a script.
**Open manual QA:** with *Automatically update internal links* turned off in Settings → Files and links,
rename a message in the file explorer and confirm the property goes stale and is reported (task H1).

### 5. Encoding: percent-encode only `%` and space

Resolution was tested for a destination written three ways: full `encodeURIComponent`, "minimal" (`%` → `%25`, space → `%20`, everything else raw), and space-only.

| Character in the filename | `encodeURIComponent` | Minimal |
| --- | --- | --- |
| Space | resolves | resolves |
| `%` | resolves | resolves |
| `& + , ; = @ $` | **does not resolve** | resolves |
| `^ [ ] ( ) ! ' ~ { }`, accents, CJK, emoji | resolves | resolves |
| `#` | **cannot be linked** in any form tested | cannot be linked |

Space-only encoding fails for a name containing `%` (`Topic 100%`), because the literal `%` is read as an escape.
An angle-bracket destination (`<Topic 100%.md>`) works for most names but not for names containing `%20`-like text, so it is not used.

Decisions that follow:

- **Writer rule:** write `%` as `%25` and a space as `%20`; write every other character raw, including non-ASCII.
  This is readable, matches what the updater itself writes, and resolves for every name tested.
  It is the concrete meaning of "URL-encoded destination" in spec §7.3.
- **Reader rule:** decode the destination once with `decodeURIComponent`, falling back to the raw text when it is malformed,
  then normalize `./` and `..` against the source file and check the topic boundary.
- **Filename rule:** topic titles and message filenames must not contain `#`. Replace it during sanitization and show the resulting path before creation (spec §12).
  Obsidian already treats `# ^ [ ] |` as link-breaking in names; `^` and `[ ]` resolved here, but the plugin removes them too so links stay predictable.

## Not covered

- Rename or move performed through the file explorer UI, and the updater-disabled setting (finding 4).
- Names containing a trailing dot or space, very long paths, and case-only renames on Windows.
- Sync-driven renames (Obsidian Sync, Git).
