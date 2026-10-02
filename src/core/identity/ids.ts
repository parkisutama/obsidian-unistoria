// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { formatFileStamp } from "./time";

const ID_BYTES = 6;
const FILE_SUFFIX_LENGTH = 6;

/** Generates `<prefix>-<12 hex chars>` from the platform's cryptographic random source. */
export function generateId(prefix: "msg" | "topic"): string {
	const bytes = new Uint8Array(ID_BYTES);
	globalThis.crypto.getRandomValues(bytes);
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
	return `${prefix}-${hex}`;
}

/** `YYYY-MM-DDTHHmmss-<6 chars of the id>.md`. The name is informational; identity is `message_id`. */
export function messageFileName(date: Date, messageId: string): string {
	const token = messageId.replace(/^msg-/, "").slice(0, FILE_SUFFIX_LENGTH);
	return `${formatFileStamp(date)}-${token}.md`;
}
