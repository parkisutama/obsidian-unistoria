// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import type { App } from "obsidian";

interface Entry {
	path: string;
	children?: Entry[];
	content?: string;
	frontmatter?: Record<string, unknown> | null;
}

/**
 * A tiny in-memory stand-in for the parts of the Obsidian app that the platform adapters use:
 * the vault, the metadata cache, and the frontmatter API.
 */
export function fakeApp() {
	const entries = new Map<string, Entry>();
	const parentOf = (p: string) => p.split("/").slice(0, -1).join("/");
	const add = (path: string, folder: boolean, content?: string) => {
		if (entries.has(path)) throw new Error("File already exists.");
		const parent = parentOf(path);
		if (parent !== "" && !entries.get(parent)?.children) throw new Error("Parent folder missing");
		const entry: Entry = folder ? { path, children: [] } : { path, content };
		entries.set(path, entry);
		entries.get(parent)?.children?.push(entry);
		return entry;
	};
	const file = (path: string) => {
		const entry = entries.get(path);
		return entry && !entry.children ? entry : null;
	};
	const state = { processFails: false };
	const app = {
		vault: {
			getAbstractFileByPath: (p: string) => entries.get(p) ?? null,
			getFileByPath: (p: string) => file(p),
			createFolder: async (p: string) => void add(p, true),
			create: async (p: string, c: string) => void add(p, false, c),
			read: async (f: Entry) => f.content ?? "",
			cachedRead: async (f: Entry) => f.content ?? "",
			process: async (f: Entry, fn: (text: string) => string) => {
				if (state.processFails) throw new Error("disk error");
				f.content = fn(f.content ?? "");
			},
			getMarkdownFiles: () =>
				[...entries.values()].filter((e) => !e.children && e.path.endsWith(".md")),
		},
		metadataCache: {
			getFileCache: (f: Entry) =>
				f.frontmatter === undefined
					? null
					: {
							frontmatter: f.frontmatter === null ? undefined : { ...f.frontmatter, position: {} },
						},
		},
		fileManager: {
			trashFile: async (f: Entry) => {
				entries.delete(f.path);
				const parent = entries.get(parentOf(f.path));
				if (parent?.children) parent.children = parent.children.filter((c) => c.path !== f.path);
			},
			// Moves a file or a whole folder, as renaming in the file explorer does.
			renameFile: async (f: Entry, to: string) => {
				if (entries.has(to)) throw new Error("Destination file already exists!");
				const from = f.path;
				const oldParent = entries.get(parentOf(from));
				if (oldParent?.children) oldParent.children = oldParent.children.filter((c) => c !== f);
				const moved = [...entries.values()].filter((e) => e === f || e.path.startsWith(`${from}/`));
				for (const entry of moved) entries.delete(entry.path);
				for (const entry of moved) {
					entry.path = to + entry.path.slice(from.length);
					entries.set(entry.path, entry);
				}
				entries.get(parentOf(to))?.children?.push(f);
			},
			processFrontMatter: async (f: Entry, mutate: (fm: Record<string, unknown>) => void) => {
				if (state.processFails) throw new Error("disk error");
				const fm = { ...(f.frontmatter ?? {}) };
				mutate(fm);
				f.frontmatter = fm;
			},
		},
	};
	return { app: app as unknown as App, entries, state };
}
