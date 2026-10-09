// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// What the conversation shows (spec §8): the normal view hides drafts, removed messages, orphans,
// and everything below them; the reveal view shows all of it, marked, for recovery and audit.

import { compareNodes, type ThreadModel, type ThreadNode } from "./thread";

export function shownRoots(model: ThreadModel, reveal: boolean): ThreadNode[] {
	if (!reveal) return model.roots.filter((node) => node.hiddenReason === null);
	return [...model.roots, ...model.orphans];
}

export function shownChildren(node: ThreadNode, reveal: boolean): ThreadNode[] {
	return reveal ? node.children : node.children.filter((child) => child.hiddenReason === null);
}

/**
 * Every reply below a message that the current view shows, at any depth, as one flat list in
 * conversation order (ADR-008). A thread is read as one level: a reply to a reply is listed with the
 * others, not nested under its parent.
 */
export function threadReplies(root: ThreadNode, reveal: boolean): ThreadNode[] {
	const replies: ThreadNode[] = [];
	const collect = (node: ThreadNode) => {
		for (const child of shownChildren(node, reveal)) {
			replies.push(child);
			collect(child);
		}
	};
	collect(root);
	return replies.sort(compareNodes);
}

/**
 * The message that starts the thread a message belongs to: the top of its parent chain. A root or
 * a detached message is its own thread root. The chain is followed through `nodes`, never guessed.
 */
export function threadRootOf(node: ThreadNode, nodes: ReadonlyMap<string, ThreadNode>): ThreadNode {
	let current = node;
	const seen = new Set<string>([node.path]);
	while (current.parentPath !== null) {
		const parent = nodes.get(current.parentPath);
		if (!parent || seen.has(parent.path)) break;
		seen.add(parent.path);
		current = parent;
	}
	return current;
}

/** `2026-10-01T10:30:45` becomes `2026-10-01 10:30`; anything else is returned as written. */
export function formatShortTime(value: string): string {
	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
	return match ? `${match[1]} ${match[2]}` : value;
}
