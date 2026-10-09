// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// A one-line, plain-text excerpt of a message body, shown above a reply to say which message it
// answers (ADR-008). It is a reading aid only: it is derived on every render and never stored.

const FENCE = /^(```|~~~)/;

function plainLine(line: string): string {
	return line
		.replace(/^(?:>\s*)+/, "")
		.replace(/^\[![^\]]*\][+-]?\s*/, "")
		.replace(/^#{1,6}\s+/, "")
		.replace(/^(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/, "")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/!?\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
		.replace(/[*_~`]/g, "")
		.trim();
}

/** The first `max` characters of a Markdown body as plain text on one line. */
export function quoteExcerpt(body: string, max = 140): string {
	let text = "";
	for (const raw of body.split(/\r?\n/)) {
		const line = raw.trim();
		if (line === "" || FENCE.test(line.replace(/^(?:>\s*)+/, ""))) continue;
		const plain = plainLine(line);
		if (plain === "") continue;
		text = text === "" ? plain : `${text} ${plain}`;
		if (text.length > max) break;
	}
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
