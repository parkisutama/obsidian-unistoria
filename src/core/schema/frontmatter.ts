// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

const FRONTMATTER = /^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/;

/** The text after a leading frontmatter block, or the whole text when there is none. */
export function bodyOf(text: string): string {
	const match = FRONTMATTER.exec(text);
	return match ? text.slice(match[0].length) : text;
}
