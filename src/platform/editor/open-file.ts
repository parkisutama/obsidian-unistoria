// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import type { App, TFile } from "obsidian";

/**
 * Shows `file` in an ordinary editor tab and makes that tab the visible, focused one.
 * A tab that already shows the file is reused; otherwise a new tab is opened. Activation and
 * reveal are explicit because a freshly created tab does not always become the active one when
 * other plugins react to tab changes.
 */
export async function openInTab(app: App, file: TFile): Promise<void> {
	const existing = app.workspace
		.getLeavesOfType("markdown")
		.find((leaf) => (leaf.view as { file?: TFile }).file?.path === file.path);
	const leaf = existing ?? app.workspace.getLeaf("tab");
	await leaf.openFile(file, { active: true });
	app.workspace.setActiveLeaf(leaf, { focus: true });
	await app.workspace.revealLeaf(leaf);
}
