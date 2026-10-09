---
title: ADR-008 Thread panel and flat threads
created: 2026-10-08T10:00:00+07:00
modified: 2026-10-08T19:30:00+07:00
tags:
  - unistoria
  - adr
---

# ADR-008 Thread panel and flat threads

- **Status:** Accepted (maintainer request, 2026-10-08; amended the same day: a reply can be answered, see Decision)
- **Date:** 2026-10-08
- **Changes:** spec §5, §9.2, and the P0 "Threaded conversation and writing" criteria, which described replies nested
  under their parent on the topic page with expand and collapse
- **Does not change:** the frontmatter schema, the link format, relationship resolution ([ADR-002](ADR-002-relationships-and-boundary.md)),
  the lifecycle ([ADR-003](ADR-003-lifecycle.md)), or the order of messages ([ADR-001](ADR-001-schema-and-time.md))
- **Evidence:** `tests/core/display.test.ts`, `tests/core/quote.test.ts`; native scripts `h3-accessibility.js` and `h4-performance.js`
  (results in [native-acceptance.md](../native-acceptance.md))

## Context

The topic page drew every reply nested under its parent, to any depth, with a control to hide a subtree.
In use, a long topic mixed several discussions on one page, deep nesting pushed text into a narrow column,
and there was no way to read one message and its replies on their own.
The maintainer asked for the model of Google Chat spaces: the page lists the messages, each message opens as a thread in a side panel,
the panel can take the whole view, and a message inside a thread cannot start a thread of its own.
The first version also removed Reply from replies. The maintainer then pointed out that people still need to answer
or comment on a particular reply inside a thread, so that part was amended before release.

## Decision

- The topic page lists only the messages that start a thread (messages with `parent: ""`).
  Each shows a thread control: the number of replies and the time of the last one, or "Open thread" when there are none.
- That control opens the thread in a panel to the right of the topic page.
  The panel shows the message in full and, below it, every reply at any depth as one flat list in conversation order
  (`created`, then `message_id`).
- The panel can be expanded to the whole view. Expanded, the topic list and the topic page are hidden
  and the header names the topic the thread belongs to. When the pane is too narrow for two columns the panel covers the topic page.
- A thread is drawn flat, and only a message on the topic page has a thread. A reply cannot be opened as a thread of its own.
- Any shown, published message can be answered. Reply on the message that starts a thread, or the panel's "Reply in thread" button,
  creates a reply whose `parent` is that message. Reply on a reply creates a reply whose `parent` is that reply.
  Several people can answer the same reply, and those answers can be answered in turn.
- A reply whose `parent` is another reply is listed in the same flat list, in time order, with a one-line quote of the message it answers
  (author, time, and the start of its text as plain text). Selecting the quote moves to that message in the panel.
  The quote is derived from the parent file on every render and is never stored.
- The data rule is unchanged: `parent` is resolved as in ADR-002, to any depth, and is never reported or rewritten because of its depth.
- Visibility follows spec §8 as before: the panel lists a reply only when the current view shows it,
  and the reveal view marks each hidden message, including a published reply hidden with its parent.
- The control that shows or hides the topic list lives in the topic list. Hidden, the list is a narrow rail that holds only that control.
- Which thread is open, whether it is expanded, and whether the topic list is hidden are view state in memory.
  They are not stored in files, settings, or the saved workspace layout.

## Alternatives considered

- Enforce one level in the data (report a `parent` that points to a reply as an integrity problem):
  rejected. It changes ADR-002 and marks existing, well-formed files as broken.
- Keep nested replies on the topic page and add the panel beside them: rejected.
  Two ways to read the same replies, and the page stays as long as before.
- Keep nesting inside the panel: rejected by the maintainer, to avoid threads inside threads.
- No Reply on replies, every new reply pointing to the message that starts the thread (the first version of this ADR):
  replaced. It kept the files one level deep but left no way to say which reply an answer is about.

## Consequences

- Expand and collapse of a reply subtree is gone; opening and closing the thread replaces it.
- The nesting of replies below replies is not drawn any more. The parent of such a reply is quoted,
  and the raw files hold the full tree, to any depth.
- Removing a reply hides the replies that answer it (spec §8), so a flat list can lose several entries at once;
  the reveal view shows them, each marked.
- A topic page renders only its thread starters, so it is shorter and cheaper to render than before;
  the replies of one thread render when its panel opens.
- Native acceptance recorded earlier for nesting and the subtree control (H3) and the message counts in H4 described the old layout;
  both scripts were rewritten for this decision.
