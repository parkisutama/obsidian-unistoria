// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Message lifecycle (spec §8, ADR-003). Only three transitions exist in v1; each one changes
// `status` and `updated` and nothing else.

import type { MessageStatus } from "../schema/schema";

const ALLOWED: ReadonlyArray<readonly [MessageStatus, MessageStatus]> = [
	["draft", "published"],
	["published", "removed"],
	["removed", "published"],
];

export type TransitionResult = { ok: true } | { ok: false; reason: "not-allowed" | "empty-body" };

export function canTransition(
	from: MessageStatus,
	to: MessageStatus,
	body: string,
): TransitionResult {
	if (!ALLOWED.some(([a, b]) => a === from && b === to))
		return { ok: false, reason: "not-allowed" };
	if (to === "published" && from === "draft" && body.trim() === "") {
		return { ok: false, reason: "empty-body" };
	}
	return { ok: true };
}

/** Replies can only be started from a published message. */
export function canReplyTo(status: MessageStatus): boolean {
	return status === "published";
}
