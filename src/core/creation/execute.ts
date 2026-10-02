// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Runs a creation plan against an abstract vault (ADR-004). The run is not atomic. It never
// overwrites, stops at the first conflict before writing anything, reports exactly what it created
// when a write fails, and can be resumed with the same plan.

import type { PlanStep, TopicPlan } from "./plan";

/** The small slice of a vault that creation needs; the Obsidian adapter implements it. */
export interface VaultIO {
	kind(path: string): Promise<"file" | "folder" | null>;
	createFolder(path: string): Promise<void>;
	createFile(path: string, content: string): Promise<void>;
	readFile(path: string): Promise<string>;
	list(path: string): Promise<string[]>;
	/** Moves to the vault's trash or deletes; the adapter decides. */
	remove(path: string): Promise<void>;
}

export interface CreatedItem {
	kind: "file" | "folder";
	path: string;
	/** The content written, for files; lets cleanup detect later edits. */
	content?: string;
}

export type RunResult =
	| { ok: true; created: CreatedItem[] }
	| { ok: false; reason: "conflict"; path: string; created: CreatedItem[] }
	| { ok: false; reason: "write-failed"; path: string; error: string; created: CreatedItem[] };

export interface RunOptions {
	/** Reuse folders that already exist and skip files whose content already matches the plan. */
	resume?: boolean;
}

async function findConflict(steps: PlanStep[], io: VaultIO, resume: boolean) {
	for (const step of steps) {
		const existing = await io.kind(step.path);
		if (existing === null) continue;
		if (step.kind === "folder") {
			if (existing === "folder" && resume) continue;
			return step.path;
		}
		if (existing === "file" && resume && (await io.readFile(step.path)) === step.content) continue;
		return step.path;
	}
	return null;
}

export async function runPlan(
	plan: TopicPlan,
	io: VaultIO,
	options: RunOptions = {},
): Promise<RunResult> {
	const created: CreatedItem[] = [];
	const conflict = await findConflict(plan.steps, io, options.resume === true);
	if (conflict !== null) return { ok: false, reason: "conflict", path: conflict, created };

	for (const step of plan.steps) {
		if ((await io.kind(step.path)) !== null) continue;
		try {
			if (step.kind === "folder") await io.createFolder(step.path);
			else await io.createFile(step.path, step.content);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { ok: false, reason: "write-failed", path: step.path, error: message, created };
		}
		created.push(
			step.kind === "folder"
				? { kind: "folder", path: step.path }
				: { kind: "file", path: step.path, content: step.content },
		);
	}
	return { ok: true, created };
}

export interface CleanupOutcome {
	removed: string[];
	kept: string[];
}

/**
 * Removes what a failed run created, newest first: files only while their content is unchanged,
 * folders only while empty. Anything the user has touched is kept.
 */
export async function cleanupCreated(created: CreatedItem[], io: VaultIO): Promise<CleanupOutcome> {
	const outcome: CleanupOutcome = { removed: [], kept: [] };
	for (const item of [...created].reverse()) {
		try {
			const unchanged =
				item.kind === "folder"
					? (await io.list(item.path)).length === 0
					: (await io.readFile(item.path)) === item.content;
			if (unchanged) {
				await io.remove(item.path);
				outcome.removed.push(item.path);
			} else {
				outcome.kept.push(item.path);
			}
		} catch {
			outcome.kept.push(item.path);
		}
	}
	return outcome;
}
