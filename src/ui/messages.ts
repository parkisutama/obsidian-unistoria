// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import type { MutationResult } from "../platform/vault/mutations";

/** A short sentence for a refused or failed mutation, for a Notice. */
export function describeFailure(result: Extract<MutationResult, { ok: false }>): string {
	switch (result.reason) {
		case "empty-body":
			return "The message is empty. Write something before publishing.";
		case "not-allowed":
			return "That change is not allowed for this message.";
		case "outside-topic":
			return "That file is not part of this topic.";
		case "not-found":
			return "The message file no longer exists.";
		case "not-ready":
			return "Obsidian has not finished indexing this file. Try again in a moment.";
		case "invalid-file":
			return `The file has invalid properties and was not changed${result.detail ? `: ${result.detail}` : ""}.`;
		case "changed":
			return "The message changed while you were working on it. Review it and try again.";
		case "write-failed":
			return `The change could not be written${result.detail ? `: ${result.detail}` : ""}.`;
	}
}
