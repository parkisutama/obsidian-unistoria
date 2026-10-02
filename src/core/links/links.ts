// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Relative Markdown links for `topic` and `parent` (ADR-002, spike S1).
// Writing percent-encodes only `%` and space. Reading accepts any form Obsidian's updater may leave.

/** Percent-encodes `%` and space; every other character, including non-ASCII, is written raw. */
export function encodeDestination(path: string): string {
	return path.replace(/%/g, "%25").replace(/ /g, "%20");
}

/** Source-relative path from the folder of `fromFile` to `toFile`; `./` for the same folder. */
export function relativePath(fromFile: string, toFile: string): string {
	const fromDir = fromFile.split("/").slice(0, -1);
	const toParts = toFile.split("/");
	const toDir = toParts.slice(0, -1);
	let common = 0;
	while (common < fromDir.length && common < toDir.length && fromDir[common] === toDir[common]) {
		common++;
	}
	const up = fromDir.length - common;
	const rest = toParts.slice(common).join("/");
	return up === 0 ? `./${rest}` : `${"../".repeat(up)}${rest}`;
}

/** A complete Markdown link from `fromFile` to `toFile`, with an encoded relative destination. */
export function buildLink(text: string, fromFile: string, toFile: string): string {
	const escaped = text.replace(/[\\[\]]/g, "\\$&");
	return `[${escaped}](${encodeDestination(relativePath(fromFile, toFile))})`;
}

export type ParsedLink =
	| { ok: true; text: string; destination: string }
	| { ok: false; reason: "not-text" | "empty" | "wikilink" | "not-a-link" | "empty-destination" };

const LINK = /^\[((?:\\.|[^\\\]])*)\]\((.*)\)$/s;

/** Parses a property value that must be exactly one inline Markdown link. */
export function parseLink(value: unknown): ParsedLink {
	if (typeof value !== "string") return { ok: false, reason: "not-text" };
	const trimmed = value.trim();
	if (trimmed === "") return { ok: false, reason: "empty" };
	if (trimmed.startsWith("[[")) return { ok: false, reason: "wikilink" };
	const match = LINK.exec(trimmed);
	if (!match) return { ok: false, reason: "not-a-link" };
	let destination = (match[2] ?? "").trim();
	if (destination.startsWith("<") && destination.endsWith(">")) {
		destination = destination.slice(1, -1).trim();
	}
	if (destination === "") return { ok: false, reason: "empty-destination" };
	return { ok: true, text: (match[1] ?? "").replace(/\\(.)/g, "$1"), destination };
}

export type ResolvedLink =
	| { ok: true; path: string }
	| { ok: false; reason: "absolute" | "fragment" | "outside-vault" | "not-markdown" };

/**
 * Resolves a link destination against the file that contains it. The destination is decoded once
 * (raw text when decoding fails). Fragments, absolute paths, schemes, paths leaving the vault, and
 * non-Markdown targets are rejected rather than guessed.
 */
export function resolveDestination(sourcePath: string, destination: string): ResolvedLink {
	if (destination.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(destination)) {
		return { ok: false, reason: "absolute" };
	}
	if (destination.includes("#")) return { ok: false, reason: "fragment" };
	let decoded = destination;
	try {
		decoded = decodeURIComponent(destination);
	} catch {
		// Not valid percent-encoding: keep the text as written.
	}
	if (decoded.includes("#")) return { ok: false, reason: "fragment" };

	const parts = sourcePath.split("/").slice(0, -1);
	for (const segment of decoded.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (parts.length === 0) return { ok: false, reason: "outside-vault" };
			parts.pop();
		} else {
			parts.push(segment);
		}
	}
	const path = parts.join("/");
	if (!path.toLowerCase().endsWith(".md")) return { ok: false, reason: "not-markdown" };
	return { ok: true, path };
}
