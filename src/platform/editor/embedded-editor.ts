// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama
//
// Adapted from Unimian, src/platform/preview/detachedLeaf.ts
// (https://github.com/parkisutama/obsidian-unimian, GPL-3.0-only, Copyright (C) 2026 Parkis Utama).
// Changes for Unistoria (ADR-006, spike S2):
//   - the leaf's `parent` is the host view's window container, so the editor belongs to the window
//     that shows it (main window or popout) instead of always the main window's root split;
//   - the handle adds `save()` and `close()` and restores the previously active leaf on close;
//   - there is no mobile branch (Unistoria is desktop only).
//
// Obsidian does not expose a way to build a `WorkspaceLeaf` that is not part of the visible layout,
// nor the `containerEl` that carries its header and editor. Both exist at runtime but not in
// `obsidian.d.ts`. This is the technique the community Hover Editor plugin uses. It is isolated in
// this file and returns null, never throws, when the expected shape is missing, so the caller can
// fall back to opening the file in an ordinary editor tab.

import { type App, type TFile, WorkspaceLeaf } from "obsidian";

export interface EmbeddedEditor {
	/** Mount this element where the editor should appear. */
	el: HTMLElement;
	/** Writes pending editor changes to the file now, instead of waiting for Obsidian's save delay. */
	save(): Promise<void>;
	/** Moves keyboard focus into the editor. */
	focus(): void;
	/** Saves, detaches the leaf, and restores the previously active leaf. Safe to call twice. */
	close(): Promise<void>;
	/** False once the editor has been closed. */
	isOpen(): boolean;
}

type UndocumentedLeafCtor = new (app: App) => WorkspaceLeaf;
type UndocumentedLeaf = WorkspaceLeaf & { containerEl?: unknown; parent?: unknown };

/**
 * Opens `file` in a leaf that is not part of the layout. `hostLeaf` is the leaf of the view that will
 * show the editor; its parent split ties the editor to the same window.
 */
export async function openEmbeddedEditor(
	app: App,
	file: TFile,
	hostLeaf: WorkspaceLeaf | null,
): Promise<EmbeddedEditor | null> {
	let leaf: UndocumentedLeaf | null = null;
	try {
		const LeafCtor = WorkspaceLeaf as unknown as UndocumentedLeafCtor;
		leaf = new LeafCtor(app) as UndocumentedLeaf;
		// The window's container (root split or popout window), not the host's tab group: activating
		// a leaf selects it in its parent tab group, and a leaf that is not one of that group's tabs
		// makes Obsidian switch the visible tab to the group's first tab.
		leaf.parent = hostLeaf?.getContainer() ?? app.workspace.rootSplit;
		await leaf.openFile(file, { active: true });

		const el = leaf.containerEl;
		if (!(el instanceof HTMLElement)) {
			detach(leaf);
			return null;
		}

		const opened = leaf;
		let closed = false;
		const save = async () => {
			const view = opened.view as { save?: () => Promise<void> };
			await view.save?.();
		};
		return {
			el,
			save,
			focus() {
				(opened.view as { editor?: { focus?: () => void } }).editor?.focus?.();
			},
			isOpen: () => !closed,
			async close() {
				if (closed) return;
				closed = true;
				try {
					await save();
				} finally {
					detach(opened);
					if (hostLeaf) app.workspace.setActiveLeaf(hostLeaf, { focus: false });
				}
			},
		};
	} catch {
		if (leaf) detach(leaf);
		return null;
	}
}

function detach(leaf: WorkspaceLeaf): void {
	try {
		leaf.detach();
	} catch {
		// The leaf was never attached to a real parent split; there is nothing more to release.
	}
}
