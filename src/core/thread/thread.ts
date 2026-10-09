// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Builds the reply tree of one topic from its message files (spec §8, §11, ADR-002, ADR-003).
// Relationships come from `parent` links resolved against the source file, never from filenames.
// A broken relationship produces an issue and an orphan; a message is never attached elsewhere.
// This module never throws on malformed input.

import { parseLink, resolveDestination } from "../links/links";
import type { MessageProps } from "../schema/schema";

/** One message file of the topic. `props` is null when the file is invalid. */
export interface MessageEntry {
	path: string;
	props: MessageProps | null;
	problems: string[];
	warnings: string[];
}

export type IssueKind =
	| "invalid-file"
	| "invalid-timestamp"
	| "duplicate-id"
	| "invalid-link"
	| "missing-parent"
	| "parent-outside-topic"
	| "parent-invalid"
	| "self-parent"
	| "cycle"
	| "topic-link-broken"
	| "topic-note-renamed"
	| "duplicate-topic-note";

export interface Issue {
	kind: IssueKind;
	path: string;
	detail: string;
}

export type HiddenReason = "draft" | "removed" | "ancestor" | "orphan";

export interface ThreadNode {
	path: string;
	props: MessageProps;
	children: ThreadNode[];
	/** Path of the parent message, or null for a root or an orphan. */
	parentPath: string | null;
	/** Why this message is detached from the tree, or null when it is attached. */
	orphanReason: IssueKind | null;
	/** Why the normal view hides the message, or null when it is visible. */
	hiddenReason: HiddenReason | null;
}

export interface ThreadModel {
	roots: ThreadNode[];
	orphans: ThreadNode[];
	drafts: ThreadNode[];
	invalid: { path: string; problems: string[] }[];
	issues: Issue[];
	nodes: Map<string, ThreadNode>;
}

const dirname = (path: string) => path.split("/").slice(0, -1).join("/");

/** Sibling order (ADR-001): `created`, then `message_id`, then path. */
export function compareNodes(a: ThreadNode, b: ThreadNode): number {
	const ta = a.props.createdMs ?? Number.POSITIVE_INFINITY;
	const tb = b.props.createdMs ?? Number.POSITIVE_INFINITY;
	if (ta !== tb) return ta < tb ? -1 : 1;
	if (a.props.messageId !== b.props.messageId)
		return a.props.messageId < b.props.messageId ? -1 : 1;
	return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

export function buildThread(entries: MessageEntry[]): ThreadModel {
	const issues: Issue[] = [];
	const invalid: ThreadModel["invalid"] = [];
	const invalidPaths = new Set<string>();
	const nodes = new Map<string, ThreadNode>();

	for (const entry of entries) {
		if (entry.props === null) {
			invalid.push({ path: entry.path, problems: entry.problems });
			invalidPaths.add(entry.path);
			issues.push({ kind: "invalid-file", path: entry.path, detail: entry.problems.join("; ") });
			continue;
		}
		nodes.set(entry.path, {
			path: entry.path,
			props: entry.props,
			children: [],
			parentPath: null,
			orphanReason: null,
			hiddenReason: null,
		});
		for (const warning of entry.warnings) {
			if (/^(created|updated) is not a valid/.test(warning)) {
				issues.push({ kind: "invalid-timestamp", path: entry.path, detail: warning });
			}
		}
	}

	const byId = new Map<string, ThreadNode[]>();
	for (const node of nodes.values()) {
		const list = byId.get(node.props.messageId) ?? [];
		list.push(node);
		byId.set(node.props.messageId, list);
	}
	for (const [id, list] of byId) {
		if (list.length < 2) continue;
		for (const node of list) {
			issues.push({
				kind: "duplicate-id",
				path: node.path,
				detail: `${id} is used by ${list.length} files`,
			});
		}
	}

	const orphan = (node: ThreadNode, kind: IssueKind, detail: string) => {
		node.orphanReason = kind;
		node.parentPath = null;
		issues.push({ kind, path: node.path, detail });
	};

	for (const node of nodes.values()) {
		if (node.props.parent === "") continue;
		const link = parseLink(node.props.parent);
		if (!link.ok) {
			orphan(node, "invalid-link", `parent link is not usable (${link.reason})`);
			continue;
		}
		const target = resolveDestination(node.path, link.destination);
		if (!target.ok) {
			orphan(node, "invalid-link", `parent destination is not usable (${target.reason})`);
			continue;
		}
		if (target.path === node.path) {
			orphan(node, "self-parent", "parent points to the message itself");
		} else if (nodes.has(target.path)) {
			node.parentPath = target.path;
		} else if (invalidPaths.has(target.path)) {
			orphan(node, "parent-invalid", `parent ${target.path} is an invalid message file`);
		} else if (dirname(target.path) !== dirname(node.path)) {
			orphan(
				node,
				"parent-outside-topic",
				`parent ${target.path} is outside this topic's messages folder`,
			);
		} else {
			orphan(node, "missing-parent", `parent ${target.path} does not exist`);
		}
	}

	// Cycle detection over the remaining parent edges; members are cut loose as orphans.
	const state = new Map<string, 1 | 2>();
	for (const start of nodes.values()) {
		const path: ThreadNode[] = [];
		let current: ThreadNode | undefined = start;
		while (current && state.get(current.path) === undefined) {
			state.set(current.path, 1);
			path.push(current);
			current = current.parentPath ? nodes.get(current.parentPath) : undefined;
		}
		if (current && state.get(current.path) === 1) {
			const members = path.slice(path.indexOf(current));
			for (const member of members)
				orphan(member, "cycle", "parent chain loops back to this message");
		}
		for (const node of path) state.set(node.path, 2);
	}

	for (const node of nodes.values()) {
		if (node.parentPath) nodes.get(node.parentPath)?.children.push(node);
	}

	const all = [...nodes.values()];
	for (const node of all) node.children.sort(compareNodes);
	const roots = all.filter(
		(n) => n.parentPath === null && n.orphanReason === null && n.props.parent === "",
	);
	const orphans = all.filter((n) => n.orphanReason !== null);
	roots.sort(compareNodes);
	orphans.sort(compareNodes);

	const markHidden = (node: ThreadNode, parentHidden: boolean, detached: boolean) => {
		if (detached) node.hiddenReason = "orphan";
		else if (parentHidden) node.hiddenReason = "ancestor";
		else if (node.props.status === "draft") node.hiddenReason = "draft";
		else if (node.props.status === "removed") node.hiddenReason = "removed";
		else node.hiddenReason = null;
		for (const child of node.children) markHidden(child, node.hiddenReason !== null, false);
	};
	for (const node of roots) markHidden(node, false, false);
	for (const node of orphans) markHidden(node, false, true);

	const drafts = all.filter((n) => n.props.status === "draft").sort(compareNodes);

	return { roots, orphans, drafts, invalid, issues, nodes };
}
