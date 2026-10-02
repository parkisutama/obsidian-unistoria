// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Creates draft messages in an existing topic (reply or root). The file is written once, as a draft;
// an existing path is never overwritten.

import type { App } from "obsidian";
import { type MessageInput, planMessage } from "../../core/creation/message";
import { createVaultIO } from "./vault-io";

export type CreateDraftResult =
	| { ok: true; path: string; messageId: string }
	| { ok: false; error: string };

export async function createDraftMessage(
	app: App,
	input: MessageInput,
): Promise<CreateDraftResult> {
	const plan = planMessage(input);
	const io = createVaultIO(app);
	try {
		if ((await io.kind(plan.path)) !== null)
			return { ok: false, error: `${plan.path} already exists` };
		await io.createFile(plan.path, plan.content);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	return { ok: true, path: plan.path, messageId: plan.messageId };
}
