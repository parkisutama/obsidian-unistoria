// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Checking a task checkbox in a rendered message or topic note, the way Obsidian's reading view does.
// It changes one marker character in the body and nothing else, only in files that belong to the
// open topic, and only when the source still shows the state the reader clicked on.

import type { App, TFile } from "obsidian";
import { toggleTask } from "../../core/markdown/tasks";
import { isTopicMessagePath } from "../../core/thread/boundary";

export type ToggleTaskResult =
	| { ok: true }
	| { ok: false; reason: "outside-topic" | "not-found" | "changed" | "write-failed" };

export async function toggleBodyTask(
	app: App,
	topic: { folder: string; notePath: string },
	path: string,
	index: number,
	wasChecked: boolean,
): Promise<ToggleTaskResult> {
	if (path !== topic.notePath && !isTopicMessagePath(topic.folder, path)) {
		return { ok: false, reason: "outside-topic" };
	}
	const file: TFile | null = app.vault.getFileByPath(path);
	if (!file) return { ok: false, reason: "not-found" };

	let changed = false;
	try {
		await app.vault.process(file, (text) => {
			const next = toggleTask(text, index, wasChecked);
			if (next === null) return text;
			changed = true;
			return next;
		});
	} catch {
		return { ok: false, reason: "write-failed" };
	}
	return changed ? { ok: true } : { ok: false, reason: "changed" };
}
