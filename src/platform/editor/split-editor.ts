// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Opens a message in an ordinary Obsidian editor pane, split off the conversation view
// (ADR-007). Unlike the embedded editor this is a real leaf in the workspace layout, so it has
// the full editing environment: the active editor, every command and hotkey, editor menus, and
// whatever other plugins add to the editor. It uses only public workspace API.

import type { App, TFile, WorkspaceLeaf } from "obsidian";

export interface EditorSession {
	/** Present when the editor is mounted inside the composer dock (embedded mode). */
	el?: HTMLElement;
	/** Writes pending editor changes to the file now, instead of waiting for Obsidian's save delay. */
	save(): Promise<void>;
	/** Moves keyboard focus into the editor. */
	focus(): void;
	/** Saves and removes the editor, and returns focus to the conversation. Safe to call twice. */
	close(): Promise<void>;
	/** False once the editor is gone, for example because the user closed its pane. */
	isOpen(): boolean;
}

/** Splits a new pane off `hostLeaf`, to its right, and opens `file` in it. */
export async function openSplitEditor(
	app: App,
	file: TFile,
	hostLeaf: WorkspaceLeaf,
): Promise<EditorSession | null> {
	let leaf: WorkspaceLeaf | null = null;
	try {
		leaf = app.workspace.createLeafBySplit(hostLeaf, "vertical", false);
		await leaf.openFile(file, { active: true });
		const opened = leaf;
		let closed = false;

		const isOpen = () => !closed && app.workspace.getLeavesOfType("markdown").includes(opened);
		const save = async () => {
			const view = opened.view as { save?: () => Promise<void> };
			await view.save?.();
		};
		return {
			save,
			isOpen,
			focus() {
				app.workspace.setActiveLeaf(opened, { focus: true });
			},
			async close() {
				if (closed) return;
				const stillThere = isOpen();
				closed = true;
				try {
					if (stillThere) await save();
				} finally {
					if (stillThere) opened.detach();
					app.workspace.setActiveLeaf(hostLeaf, { focus: false });
				}
			},
		};
	} catch {
		if (leaf) {
			try {
				leaf.detach();
			} catch {
				// Nothing more to release.
			}
		}
		return null;
	}
}
