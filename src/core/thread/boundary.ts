// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Topic membership is physical (ADR-002): a message belongs to the topic whose `messages/` folder
// contains it. A link read from frontmatter never extends this boundary.

const dirname = (path: string) => path.split("/").slice(0, -1).join("/");
const join = (a: string, b: string) => (a === "" ? b : `${a}/${b}`);

export function messagesFolderOf(topicFolder: string): string {
	return join(topicFolder, "messages");
}

/** True for a Markdown file directly inside the topic's `messages/` folder, with no dot segments. */
export function isTopicMessagePath(topicFolder: string, path: string): boolean {
	if (path.split("/").some((segment) => segment === ".." || segment === ".")) return false;
	return dirname(path) === messagesFolderOf(topicFolder) && path.toLowerCase().endsWith(".md");
}

/**
 * The topic folder a vault event concerns: the parent of `messages/` for a message file,
 * otherwise the file's own folder (the Folder Note).
 */
export function topicFolderOf(path: string): string {
	const dir = dirname(path);
	return dir.split("/").pop() === "messages" ? dirname(dir) : dir;
}
