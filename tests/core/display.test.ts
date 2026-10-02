import { describe, expect, it } from "vitest";
import { parseMessageProps } from "../../src/core/schema/schema";
import {
	countReplies,
	formatShortTime,
	shownChildren,
	shownRoots,
} from "../../src/core/thread/display";
import { buildThread, type MessageEntry } from "../../src/core/thread/thread";

const DIR = "T/messages";

function entry(file: string, over: Record<string, unknown> = {}): MessageEntry {
	const result = parseMessageProps({
		type: "discussion-message",
		message_id: `msg-${file}`,
		topic: "[T](../T.md)",
		parent: "",
		status: "published",
		created: "2026-10-01T10:00:00",
		updated: "2026-10-01T10:00:00",
		author: "",
		...over,
	});
	if (!result.ok) throw new Error(result.problems.join());
	return {
		path: `${DIR}/${file}.md`,
		props: result.value,
		problems: [],
		warnings: result.warnings,
	};
}
const reply = (file: string, parent: string, over: Record<string, unknown> = {}) =>
	entry(file, { parent: `[p](./${parent}.md)`, ...over });
const names = (nodes: { path: string }[]) =>
	nodes.map((n) => n.path.split("/").pop()?.replace(".md", ""));

const model = () =>
	buildThread([
		entry("a"),
		reply("b", "a"),
		reply("c", "b"),
		reply("d", "a", { status: "removed" }),
		reply("e", "d"),
		entry("f", { status: "draft" }),
		reply("g", "gone"),
	]);

describe("normal view", () => {
	it("shows only published roots and published descendants of published ancestors", () => {
		const m = model();
		expect(names(shownRoots(m, false))).toEqual(["a"]);
		const a = m.nodes.get(`${DIR}/a.md`);
		expect(names(shownChildren(a as never, false))).toEqual(["b"]);
	});

	it("counts the replies a reader can see", () => {
		const m = model();
		expect(countReplies(m.nodes.get(`${DIR}/a.md`) as never, false)).toBe(2);
		expect(countReplies(m.nodes.get(`${DIR}/b.md`) as never, false)).toBe(1);
		expect(countReplies(m.nodes.get(`${DIR}/c.md`) as never, false)).toBe(0);
	});
});

describe("reveal view", () => {
	it("also shows removed and draft messages, their descendants, and orphans", () => {
		const m = model();
		expect(names(shownRoots(m, true))).toEqual(["a", "f", "g"]);
		const a = m.nodes.get(`${DIR}/a.md`);
		expect(names(shownChildren(a as never, true))).toEqual(["b", "d"]);
		expect(countReplies(a as never, true)).toBe(4);
	});
});

describe("formatShortTime", () => {
	it("drops the T and the seconds", () => {
		expect(formatShortTime("2026-10-01T10:30:45")).toBe("2026-10-01 10:30");
		expect(formatShortTime("2026-10-01T10:30")).toBe("2026-10-01 10:30");
	});

	it("returns an unparsable value unchanged and an empty one as empty", () => {
		expect(formatShortTime("yesterday")).toBe("yesterday");
		expect(formatShortTime("")).toBe("");
	});
});
