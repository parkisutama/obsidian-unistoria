// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Changing the folder of a Space. A Space is only a folder, so this is a folder move done the way
// the file explorer does it: Obsidian's link updater runs, and the relative `topic` and `parent`
// links inside the Space keep resolving (spike S1).

import type { App } from "obsidian";
import { escapesVault } from "../../core/identity/vault-path";
import { ensureFolder } from "./vault-io";

export type RelocateResult =
	/** `moved`: the folder was renamed. `repointed`: the destination already existed; no file changed. */
	{ ok: true; action: "moved" | "repointed"; path: string } | { ok: false; error: string };

const clean = (path: string) => path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
const isFolder = (entry: unknown) =>
	typeof entry === "object" && entry !== null && "children" in entry;

/**
 * Points a Space at `to`. When a folder already exists there, nothing is written and the caller
 * only updates its pointer; folders are never merged. Otherwise the folder at `from` is moved.
 */
export async function relocateSpaceFolder(
	app: App,
	from: string,
	to: string,
): Promise<RelocateResult> {
	const source = clean(from);
	const target = clean(to);
	if (target === "") return { ok: false, error: "Enter a folder path." };
	if (escapesVault(target)) return { ok: false, error: `Path leaves the vault: "${target}"` };
	if (target === source) return { ok: false, error: "The space already uses that folder." };
	if (target.startsWith(`${source}/`)) {
		return { ok: false, error: "A space cannot be moved into itself." };
	}

	const existing = app.vault.getAbstractFileByPath(target);
	if (existing !== null) {
		if (!isFolder(existing)) return { ok: false, error: `A file already exists at ${target}` };
		return { ok: true, action: "repointed", path: target };
	}

	const folder = app.vault.getAbstractFileByPath(source);
	if (folder === null || !isFolder(folder)) {
		return {
			ok: false,
			error: `Neither ${source} nor ${target} exists. Choose the folder the space lives in now.`,
		};
	}
	try {
		const parent = target.split("/").slice(0, -1).join("/");
		if (parent !== "") await ensureFolder(app, parent);
		await app.fileManager.renameFile(folder, target);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	return { ok: true, action: "moved", path: target };
}
