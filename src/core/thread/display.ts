// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// What the conversation shows (spec §8): the normal view hides drafts, removed messages, orphans,
// and everything below them; the reveal view shows all of it, marked, for recovery and audit.

import type { ThreadModel, ThreadNode } from "./thread";

export function shownRoots(model: ThreadModel, reveal: boolean): ThreadNode[] {
	if (!reveal) return model.roots.filter((node) => node.hiddenReason === null);
	return [...model.roots, ...model.orphans];
}

export function shownChildren(node: ThreadNode, reveal: boolean): ThreadNode[] {
	return reveal ? node.children : node.children.filter((child) => child.hiddenReason === null);
}

/** Replies below a message that the current view shows, at any depth. */
export function countReplies(node: ThreadNode, reveal: boolean): number {
	let total = 0;
	for (const child of shownChildren(node, reveal)) total += 1 + countReplies(child, reveal);
	return total;
}

/** `2026-10-01T10:30:45` becomes `2026-10-01 10:30`; anything else is returned as written. */
export function formatShortTime(value: string): string {
	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
	return match ? `${match[1]} ${match[2]}` : value;
}
