// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Topic titles become folder and file names. Remove what a file system cannot store and what
// Obsidian cannot link to (ADR-002, spike S1): `#` can never be linked; `^ [ ] |` are removed too.

const MAX_LENGTH = 120;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what is removed
const REMOVED = /[#^[\]|\\/:*?"<>\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export type SanitizeResult =
	| { ok: true; name: string; changed: boolean }
	| { ok: false; reason: "empty" | "reserved" };

export function sanitizeTitle(title: string): SanitizeResult {
	let name = title.replace(REMOVED, "").replace(/\s+/g, " ").trim();
	if (name.length > MAX_LENGTH) name = name.slice(0, MAX_LENGTH);
	name = name.replace(/[. ]+$/, "");
	if (name === "") return { ok: false, reason: "empty" };
	if (RESERVED.test(name.split(".")[0] ?? name)) return { ok: false, reason: "reserved" };
	return { ok: true, name, changed: name !== title };
}
