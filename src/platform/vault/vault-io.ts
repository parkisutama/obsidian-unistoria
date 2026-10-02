// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Obsidian implementation of the creation IO. This directory is the only place that calls vault
// write APIs (enforced by tests/architecture.test.ts).

import type { App, TFile, TFolder } from "obsidian";
import type { VaultIO } from "../../core/creation/execute";

const isFolder = (entry: unknown): entry is TFolder =>
	typeof entry === "object" && entry !== null && "children" in entry;

export function createVaultIO(app: App): VaultIO {
	const entry = (path: string) => app.vault.getAbstractFileByPath(path);
	return {
		async kind(path) {
			const found = entry(path);
			if (found === null) return null;
			return isFolder(found) ? "folder" : "file";
		},
		async createFolder(path) {
			await app.vault.createFolder(path);
		},
		async createFile(path, content) {
			await app.vault.create(path, content);
		},
		async readFile(path) {
			const found = entry(path);
			if (found === null || isFolder(found)) throw new Error(`Not a file: ${path}`);
			return app.vault.read(found as TFile);
		},
		async list(path) {
			const found = entry(path);
			if (!isFolder(found)) return [];
			return found.children.map((child) => child.path);
		},
		async remove(path) {
			const found = entry(path);
			if (found !== null) await app.fileManager.trashFile(found);
		},
	};
}

/** Creates a folder and any missing ancestors; an existing folder is left untouched. */
export async function ensureFolder(app: App, path: string): Promise<void> {
	const io = createVaultIO(app);
	let current = "";
	for (const part of path.split("/").filter((p) => p !== "")) {
		current = current === "" ? part : `${current}/${part}`;
		const kind = await io.kind(current);
		if (kind === "file") throw new Error(`A file already exists at ${current}`);
		if (kind === null) await io.createFolder(current);
	}
}
