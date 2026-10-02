// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Local wall-clock time without a UTC offset (ADR-001, spec §7.6). Obsidian has no multi-time-zone
// support, so no offset is ever written. Parsed values are epoch milliseconds computed as if the
// local time were UTC, which keeps ordering independent of the machine's time zone.

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Formats a date as `YYYY-MM-DDTHH:mm:ss` in local time. */
export function formatTimestamp(date: Date): string {
	return `${formatDay(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Formats a date as `YYYY-MM-DDTHHmmss` in local time, for filenames. */
export function formatFileStamp(date: Date): string {
	return `${formatDay(date)}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatDay(date: Date): string {
	return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parses `YYYY-MM-DDTHH:mm:ss` or `YYYY-MM-DDTHH:mm`. Returns null for anything else, including
 * values with an offset, a date alone, or an impossible calendar date.
 */
export function parseTimestamp(value: unknown): number | null {
	if (typeof value !== "string") return null;
	const match = TIMESTAMP.exec(value.trim());
	if (!match) return null;
	const [year, month, day, hour, minute] = match.slice(1, 6).map(Number) as [
		number,
		number,
		number,
		number,
		number,
	];
	const second = match[6] === undefined ? 0 : Number(match[6]);
	if (hour > 23 || minute > 59 || second > 59) return null;
	const ms = Date.UTC(year, month - 1, day, hour, minute, second);
	const check = new Date(ms);
	if (
		check.getUTCFullYear() !== year ||
		check.getUTCMonth() !== month - 1 ||
		check.getUTCDate() !== day
	) {
		return null;
	}
	return ms;
}
