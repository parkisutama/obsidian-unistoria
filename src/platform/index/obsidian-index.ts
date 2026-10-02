// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Connects TopicIndex to Obsidian: reads cached frontmatter, falls back to parsing the file when the
// cache has not indexed it, and turns vault and metadata events into index updates.

import {
	type App,
	type Plugin,
	parseYaml,
	type TAbstractFile,
	type TFolder,
	Vault,
} from "obsidian";
import type { IndexHost, TopicIndex } from "./topic-index";

type Frontmatter = Record<string, unknown>;

const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;
const DEBOUNCE_MS = 150;

export function createIndexHost(app: App): IndexHost {
	return {
		markdownPaths: () => app.vault.getMarkdownFiles().map((file) => file.path),
		exists: (path) => app.vault.getFileByPath(path) !== null,
		frontmatter(path) {
			const file = app.vault.getFileByPath(path);
			const cache = file ? app.metadataCache.getFileCache(file) : null;
			if (!cache) return undefined;
			if (!cache.frontmatter) return null;
			const { position: _position, ...rest } = cache.frontmatter as Frontmatter;
			return rest;
		},
		async readFrontmatter(path) {
			const file = app.vault.getFileByPath(path);
			if (!file) return null;
			const match = FRONTMATTER_BLOCK.exec(await app.vault.cachedRead(file));
			if (!match) return null;
			try {
				const parsed: unknown = parseYaml(match[1] ?? "");
				return typeof parsed === "object" && parsed !== null ? (parsed as Frontmatter) : null;
			} catch {
				return null;
			}
		},
	};
}

const isFolder = (entry: TAbstractFile): entry is TFolder => "children" in entry;

/** Paths whose topics may have changed: the entry itself, or every file under a renamed folder. */
function pathsOf(entry: TAbstractFile, oldPath?: string): string[] {
	if (!isFolder(entry)) return oldPath ? [entry.path, oldPath] : [entry.path];
	const paths = [entry.path];
	if (oldPath) paths.push(oldPath);
	Vault.recurseChildren(entry, (child) => {
		paths.push(child.path);
		if (oldPath) paths.push(oldPath + child.path.slice(entry.path.length));
	});
	return paths;
}

/** Keeps the index current. Registered events and the debounce timer are released on unload. */
export function registerIndexEvents(plugin: Plugin, app: App, index: TopicIndex): void {
	const pending = new Set<string>();
	let timer: number | null = null;

	const flush = () => {
		timer = null;
		const paths = [...pending];
		pending.clear();
		void index.update(paths);
	};
	const queue = (paths: string[]) => {
		for (const path of paths) pending.add(path);
		if (timer === null) timer = window.setTimeout(flush, DEBOUNCE_MS);
	};
	plugin.register(() => {
		if (timer !== null) window.clearTimeout(timer);
	});

	plugin.registerEvent(app.vault.on("create", (entry) => queue(pathsOf(entry))));
	plugin.registerEvent(app.vault.on("modify", (entry) => queue(pathsOf(entry))));
	plugin.registerEvent(app.vault.on("delete", (entry) => queue(pathsOf(entry))));
	plugin.registerEvent(app.vault.on("rename", (entry, oldPath) => queue(pathsOf(entry, oldPath))));
	plugin.registerEvent(app.metadataCache.on("changed", (file) => queue([file.path])));
	plugin.registerEvent(app.metadataCache.on("resolved", () => void index.rebuild()));
}
