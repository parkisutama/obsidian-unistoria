// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Task list items in a message or topic body. Obsidian's renderer gives checkboxes no source line,
// so a checkbox is matched to its source by order. A toggle is applied only when the source still
// has the state the reader saw, so a stale click can never change the wrong line.

import { bodyOf } from "../schema/frontmatter";

const TASK = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)(.)(\](?:\s|$))/;
const FENCE = /^\s*(?:>\s*)*(```|~~~)/;

interface TaskRef {
	/** Offset of the marker character, counted from the start of the whole file text. */
	offset: number;
	marker: string;
}

function findTasks(text: string): TaskRef[] {
	const body = bodyOf(text);
	const bodyStart = text.length - body.length;
	const tasks: TaskRef[] = [];
	let inFence: string | null = null;
	let lineStart = 0;
	while (lineStart <= body.length) {
		const newline = body.indexOf("\n", lineStart);
		const lineEnd = newline === -1 ? body.length : newline;
		const line = body.slice(lineStart, lineEnd).replace(/\r$/, "");

		const fence = FENCE.exec(line);
		if (fence) {
			if (inFence === null) inFence = fence[1] ?? null;
			else if (inFence === fence[1]) inFence = null;
		} else if (inFence === null) {
			const task = TASK.exec(line);
			if (task) {
				tasks.push({
					offset: bodyStart + lineStart + (task[1]?.length ?? 0),
					marker: task[2] ?? " ",
				});
			}
		}
		if (newline === -1) break;
		lineStart = newline + 1;
	}
	return tasks;
}

const isDone = (marker: string) => marker === "x" || marker === "X";

export function countTasks(text: string): number {
	return findTasks(text).length;
}

/**
 * Flips the Nth task of the body. `wasChecked` is the state the reader saw; if the source differs,
 * or the index is out of range, nothing is changed and null is returned.
 */
export function toggleTask(text: string, index: number, wasChecked: boolean): string | null {
	const task = findTasks(text)[index];
	if (!task || isDone(task.marker) !== wasChecked) return null;
	return `${text.slice(0, task.offset)}${wasChecked ? " " : "x"}${text.slice(task.offset + 1)}`;
}
