import { describe, expect, it } from "vitest";
import { generateId, messageFileName } from "../../src/core/identity/ids";
import { sanitizeTitle } from "../../src/core/identity/sanitize";
import { formatFileStamp, formatTimestamp, parseTimestamp } from "../../src/core/identity/time";

describe("generateId", () => {
	it("prefixes a lowercase hex token", () => {
		expect(generateId("msg")).toMatch(/^msg-[0-9a-f]{12}$/);
		expect(generateId("topic")).toMatch(/^topic-[0-9a-f]{12}$/);
	});

	it("does not collide across 100,000 ids", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 100_000; i++) seen.add(generateId("msg"));
		expect(seen.size).toBe(100_000);
	});
});

describe("timestamps", () => {
	it("formats local time without an offset", () => {
		const date = new Date(2026, 9, 1, 10, 30, 5);
		expect(formatTimestamp(date)).toBe("2026-10-01T10:30:05");
		expect(formatFileStamp(date)).toBe("2026-10-01T103005");
	});

	it("parses seconds and minute precision", () => {
		expect(parseTimestamp("2026-10-01T10:30:05")).toBe(Date.UTC(2026, 9, 1, 10, 30, 5));
		expect(parseTimestamp("2026-10-01T10:30")).toBe(Date.UTC(2026, 9, 1, 10, 30, 0));
	});

	it("round-trips a formatted value", () => {
		const date = new Date(2026, 0, 31, 23, 59, 59);
		expect(parseTimestamp(formatTimestamp(date))).toBe(Date.UTC(2026, 0, 31, 23, 59, 59));
	});

	it.each([
		["not a date"],
		[""],
		["2026-10-01"],
		["2026-10-01T10:30:00+07:00"],
		["2026-10-01T10:30:00Z"],
		["2026-13-01T10:30:00"],
		["2026-02-30T10:30:00"],
		["2026-10-01T24:00:00"],
		["2026-10-01T10:60:00"],
		["2026-10-01T10:30:60"],
	])("rejects %s", (value) => {
		expect(parseTimestamp(value)).toBeNull();
	});

	it("rejects non-strings", () => {
		expect(parseTimestamp(undefined)).toBeNull();
		expect(parseTimestamp(20261001)).toBeNull();
		expect(parseTimestamp(new Date())).toBeNull();
	});
});

describe("messageFileName", () => {
	it("combines the file stamp and a short id suffix", () => {
		const name = messageFileName(new Date(2026, 9, 1, 10, 45, 0), "msg-abcdef123456");
		expect(name).toBe("2026-10-01T104500-abcdef.md");
	});
});

describe("sanitizeTitle", () => {
	it("keeps a plain title and reports no change", () => {
		expect(sanitizeTitle("Topic Name")).toEqual({ ok: true, name: "Topic Name", changed: false });
	});

	it("removes characters that cannot be linked or stored", () => {
		const result = sanitizeTitle('Plan #1: [draft] ^v2 | "x" <y> a/b\\c*d?');
		expect(result).toEqual({ ok: true, name: "Plan 1 draft v2 x y abcd", changed: true });
	});

	it("collapses whitespace and trims trailing dots and spaces", () => {
		expect(sanitizeTitle("  a   b . ")).toEqual({ ok: true, name: "a b", changed: true });
	});

	it("keeps other punctuation, accents, and non-ASCII text", () => {
		expect(sanitizeTitle("Tópik & 100% (日本) +x")).toEqual({
			ok: true,
			name: "Tópik & 100% (日本) +x",
			changed: false,
		});
	});

	it("rejects an empty result", () => {
		expect(sanitizeTitle("###")).toEqual({ ok: false, reason: "empty" });
		expect(sanitizeTitle("   ")).toEqual({ ok: false, reason: "empty" });
	});

	it("rejects reserved Windows device names", () => {
		expect(sanitizeTitle("con")).toEqual({ ok: false, reason: "reserved" });
		expect(sanitizeTitle("LPT1")).toEqual({ ok: false, reason: "reserved" });
	});

	it("limits the length", () => {
		const result = sanitizeTitle("a".repeat(300));
		expect(result.ok && result.name.length).toBe(120);
		expect(result.ok && result.changed).toBe(true);
	});

	it("is deterministic", () => {
		expect(sanitizeTitle("a#b")).toEqual(sanitizeTitle("a#b"));
	});
});
