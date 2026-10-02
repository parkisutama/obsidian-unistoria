// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// The only path by which the plugin changes an existing message (spec §9.3, ADR-003, ADR-005).
// A status change writes `status` and `updated` through Obsidian's frontmatter API and nothing else;
// the body is never touched. Files outside the open topic's `messages/` folder are refused.

import type { App, TFile } from "obsidian";
import { formatTimestamp } from "../../core/identity/time";
import { canTransition } from "../../core/lifecycle/lifecycle";
import { bodyOf } from "../../core/schema/frontmatter";
import {
	type MessageStatus,
	parseMessageProps,
	parseTopicProps,
	type TopicStatus,
} from "../../core/schema/schema";
import { isTopicMessagePath } from "../../core/thread/boundary";

/** The slice of Obsidian that mutations need; the adapter below implements it. */
export interface MutationHost {
	exists(path: string): boolean;
	readText(path: string): Promise<string>;
	/** Cached frontmatter; undefined when the metadata cache has not indexed the file yet. */
	frontmatter(path: string): Record<string, unknown> | undefined;
	updateFrontmatter(path: string, mutate: (fm: Record<string, unknown>) => void): Promise<void>;
	now(): Date;
}

export type MutationResult =
	| { ok: true }
	| {
			ok: false;
			reason:
				| "outside-topic"
				| "not-found"
				| "not-ready"
				| "invalid-file"
				| "not-allowed"
				| "empty-body"
				| "changed"
				| "write-failed";
			detail?: string;
	  };

class StatusChanged extends Error {}

export async function setMessageStatus(
	host: MutationHost,
	topicFolder: string,
	path: string,
	to: MessageStatus,
): Promise<MutationResult> {
	if (!isTopicMessagePath(topicFolder, path)) return { ok: false, reason: "outside-topic" };
	if (!host.exists(path)) return { ok: false, reason: "not-found" };

	const cached = host.frontmatter(path);
	if (cached === undefined) return { ok: false, reason: "not-ready" };
	const parsed = parseMessageProps(cached);
	if (!parsed.ok) return { ok: false, reason: "invalid-file", detail: parsed.problems.join("; ") };

	const from = parsed.value.status;
	const allowed = canTransition(from, to, bodyOf(await host.readText(path)));
	if (!allowed.ok) return { ok: false, reason: allowed.reason };

	const updated = formatTimestamp(host.now());
	try {
		await host.updateFrontmatter(path, (fm) => {
			if (fm.status !== from) throw new StatusChanged();
			fm.status = to;
			fm.updated = updated;
		});
	} catch (error) {
		if (error instanceof StatusChanged) return { ok: false, reason: "changed" };
		return {
			ok: false,
			reason: "write-failed",
			detail: error instanceof Error ? error.message : String(error),
		};
	}
	return { ok: true };
}

/**
 * Opens or closes a topic: writes `status` and `updated` on the Folder Note only. No message file
 * moves or changes (spec P1, §9.2).
 */
export async function setTopicStatus(
	host: MutationHost,
	topicFolder: string,
	notePath: string,
	to: TopicStatus,
): Promise<MutationResult> {
	const noteFolder = notePath.split("/").slice(0, -1).join("/");
	if (noteFolder !== topicFolder || !notePath.toLowerCase().endsWith(".md")) {
		return { ok: false, reason: "outside-topic" };
	}
	if (!host.exists(notePath)) return { ok: false, reason: "not-found" };
	const cached = host.frontmatter(notePath);
	if (cached === undefined) return { ok: false, reason: "not-ready" };
	const parsed = parseTopicProps(cached);
	if (!parsed.ok) return { ok: false, reason: "invalid-file", detail: parsed.problems.join("; ") };
	if (parsed.value.status === to) return { ok: true };

	const from = parsed.value.status;
	const updated = formatTimestamp(host.now());
	try {
		await host.updateFrontmatter(notePath, (fm) => {
			if (fm.status !== from) throw new StatusChanged();
			fm.status = to;
			fm.updated = updated;
		});
	} catch (error) {
		if (error instanceof StatusChanged) return { ok: false, reason: "changed" };
		return {
			ok: false,
			reason: "write-failed",
			detail: error instanceof Error ? error.message : String(error),
		};
	}
	return { ok: true };
}

export function createMutationHost(app: App): MutationHost {
	const file = (path: string) => app.vault.getFileByPath(path);
	const need = (path: string): TFile => {
		const found = file(path);
		if (!found) throw new Error(`Not found: ${path}`);
		return found;
	};
	return {
		exists: (path) => file(path) !== null,
		readText: async (path) => app.vault.read(need(path)),
		frontmatter(path) {
			const found = file(path);
			const cache = found ? app.metadataCache.getFileCache(found) : null;
			if (!cache) return undefined;
			const { position: _position, ...rest } = (cache.frontmatter ?? {}) as Record<string, unknown>;
			return rest;
		},
		updateFrontmatter: (path, mutate) => app.fileManager.processFrontMatter(need(path), mutate),
		now: () => new Date(),
	};
}
