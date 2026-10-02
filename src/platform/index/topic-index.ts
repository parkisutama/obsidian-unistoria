// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Read model of every topic in the vault (spec §9.3, §11). A topic is a Folder Note with
// `type: discussion-topic`; its messages are the Markdown files directly inside `messages/`.
// The index only reads. It rebuilds the affected topic when vault events arrive, reports broken
// relationships as issues, and never repairs or guesses (ADR-002).

import { parseLink, resolveDestination } from "../../core/links/links";
import { parseMessageProps, parseTopicProps, type TopicProps } from "../../core/schema/schema";
import { isTopicMessagePath, topicFolderOf } from "../../core/thread/boundary";
import {
	buildThread,
	type Issue,
	type MessageEntry,
	type ThreadModel,
} from "../../core/thread/thread";

type Frontmatter = Record<string, unknown>;

/** The slice of Obsidian the index reads; `obsidian-index.ts` implements it. */
export interface IndexHost {
	markdownPaths(): string[];
	exists(path: string): boolean;
	/** Cached frontmatter: undefined when not indexed yet, null when the file has none. */
	frontmatter(path: string): Frontmatter | null | undefined;
	/** Reads and parses the file directly, for files the cache has not indexed. */
	readFrontmatter(path: string): Promise<Frontmatter | null>;
}

export interface TopicSnapshot {
	folderPath: string;
	notePath: string;
	name: string;
	/** The folder that contains the topic folder. */
	spacePath: string;
	/** Null when the Folder Note's properties are invalid. */
	props: TopicProps | null;
	problems: string[];
	thread: ThreadModel;
	/** Thread issues plus topic-level issues. */
	issues: Issue[];
}

const dirname = (path: string) => path.split("/").slice(0, -1).join("/");
const basename = (path: string) => path.split("/").pop() ?? path;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class TopicIndex {
	private snapshots = new Map<string, TopicSnapshot>();
	private listeners = new Set<(folders: Set<string>) => void>();

	constructor(private readonly host: IndexHost) {}

	topics(): TopicSnapshot[] {
		return [...this.snapshots.values()].sort(
			(a, b) =>
				compare(a.spacePath, b.spacePath) ||
				compare(a.name, b.name) ||
				compare(a.folderPath, b.folderPath),
		);
	}

	topic(folderPath: string): TopicSnapshot | undefined {
		return this.snapshots.get(folderPath);
	}

	/** Duplicate topic ids anywhere, and message ids reused across different topics. */
	vaultIssues(): Issue[] {
		const issues: Issue[] = [];
		const topicIds = new Map<string, string[]>();
		const messageIds = new Map<string, { path: string; folder: string }[]>();
		for (const snap of this.snapshots.values()) {
			if (snap.props) {
				const list = topicIds.get(snap.props.topicId) ?? [];
				list.push(snap.notePath);
				topicIds.set(snap.props.topicId, list);
			}
			for (const node of snap.thread.nodes.values()) {
				const list = messageIds.get(node.props.messageId) ?? [];
				list.push({ path: node.path, folder: snap.folderPath });
				messageIds.set(node.props.messageId, list);
			}
		}
		for (const [id, paths] of topicIds) {
			if (paths.length < 2) continue;
			for (const path of paths)
				issues.push({
					kind: "duplicate-id",
					path,
					detail: `${id} is used by ${paths.length} topics`,
				});
		}
		for (const [id, holders] of messageIds) {
			if (new Set(holders.map((h) => h.folder)).size < 2) continue;
			for (const holder of holders) {
				issues.push({
					kind: "duplicate-id",
					path: holder.path,
					detail: `${id} is used in ${holders.length} files across topics`,
				});
			}
		}
		return issues;
	}

	subscribe(listener: (folders: Set<string>) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Full rebuild that announces every topic folder, used once the metadata cache is resolved. */
	async rebuild(): Promise<void> {
		const before = new Set(this.snapshots.keys());
		await this.build();
		const all = new Set([...before, ...this.snapshots.keys()]);
		if (all.size > 0) for (const listener of this.listeners) listener(all);
	}

	/** Full rebuild; does not notify listeners. */
	async build(): Promise<void> {
		const paths = this.host.markdownPaths();
		const folders = new Set<string>();
		for (const path of paths) {
			if ((await this.frontmatterOf(path))?.type === "discussion-topic") folders.add(dirname(path));
		}
		this.snapshots.clear();
		for (const folder of folders) {
			const snap = await this.snapshot(folder, paths);
			if (snap) this.snapshots.set(folder, snap);
		}
	}

	/**
	 * Re-reads the topics affected by changed paths (old and new paths of a rename both count).
	 * Returns, and announces to listeners, the topic folders whose snapshot changed or vanished.
	 */
	async update(changedPaths: string[]): Promise<Set<string>> {
		const folders = new Set(changedPaths.map(topicFolderOf));
		const paths = this.host.markdownPaths();
		const changed = new Set<string>();
		for (const folder of folders) {
			const next = await this.snapshot(folder, paths);
			const had = this.snapshots.has(folder);
			if (next) this.snapshots.set(folder, next);
			else this.snapshots.delete(folder);
			if (next || had) changed.add(folder);
		}
		if (changed.size > 0) for (const listener of this.listeners) listener(changed);
		return changed;
	}

	private async frontmatterOf(path: string): Promise<Frontmatter | null> {
		const cached = this.host.frontmatter(path);
		if (cached !== undefined) return cached;
		return this.host.readFrontmatter(path);
	}

	private async snapshot(folder: string, paths: string[]): Promise<TopicSnapshot | null> {
		const notes: string[] = [];
		for (const path of paths) {
			if (dirname(path) !== folder) continue;
			if ((await this.frontmatterOf(path))?.type === "discussion-topic") notes.push(path);
		}
		if (notes.length === 0) return null;

		const name = basename(folder);
		notes.sort(compare);
		const notePath = notes.find((p) => basename(p) === `${name}.md`) ?? (notes[0] as string);
		const parsed = parseTopicProps((await this.frontmatterOf(notePath)) ?? {});
		const extra: Issue[] = [];

		for (const other of notes) {
			if (other === notePath) continue;
			extra.push({
				kind: "duplicate-topic-note",
				path: other,
				detail: `${notePath} is already this folder's Folder Note`,
			});
		}
		if (basename(notePath) !== `${name}.md`) {
			extra.push({
				kind: "topic-note-renamed",
				path: notePath,
				detail: `The Folder Note is named ${basename(notePath)}, not ${name}.md`,
			});
		}

		const entries: MessageEntry[] = [];
		for (const path of paths) {
			if (!isTopicMessagePath(folder, path)) continue;
			const fm = await this.frontmatterOf(path);
			if (fm === null) {
				entries.push({ path, props: null, problems: ["The file has no properties"], warnings: [] });
				continue;
			}
			const result = parseMessageProps(fm);
			entries.push(
				result.ok
					? { path, props: result.value, problems: [], warnings: result.warnings }
					: { path, props: null, problems: result.problems, warnings: [] },
			);
		}

		const thread = buildThread(entries);
		for (const entry of entries) {
			if (!entry.props) continue;
			const link = parseLink(entry.props.topic);
			const target = link.ok ? resolveDestination(entry.path, link.destination) : null;
			if (!target?.ok || target.path !== notePath || !this.host.exists(notePath)) {
				extra.push({
					kind: "topic-link-broken",
					path: entry.path,
					detail: `The topic link does not point to this topic's Folder Note (${notePath})`,
				});
			}
		}

		return {
			folderPath: folder,
			notePath,
			name,
			spacePath: dirname(folder),
			props: parsed.ok ? parsed.value : null,
			problems: parsed.ok ? [] : parsed.problems,
			thread,
			issues: [...thread.issues, ...extra],
		};
	}
}
