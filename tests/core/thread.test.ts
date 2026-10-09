// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { parseMessageProps } from "../../src/core/schema/schema";
import { buildThread, type MessageEntry } from "../../src/core/thread/thread";

const DIR = "T/messages";

function entry(file: string, over: Record<string, unknown> = {}, dir = DIR): MessageEntry {
	const path = `${dir}/${file}.md`;
	const raw = {
		type: "discussion-message",
		message_id: `msg-${file}`,
		topic: "[T](../T.md)",
		parent: "",
		status: "published",
		created: "2026-10-01T10:00:00",
		updated: "2026-10-01T10:00:00",
		author: "",
		...over,
	};
	const result = parseMessageProps(raw);
	return result.ok
		? { path, props: result.value, problems: [], warnings: result.warnings }
		: { path, props: null, problems: result.problems, warnings: [] };
}

const reply = (file: string, parent: string, over: Record<string, unknown> = {}) =>
	entry(file, { parent: `[p](./${parent}.md)`, ...over });

const kinds = (model: ReturnType<typeof buildThread>) =>
	model.issues.map((i) => `${i.kind}:${i.path}`);
const names = (nodes: { path: string }[]) =>
	nodes.map((n) => n.path.split("/").pop()?.replace(".md", ""));

describe("buildThread", () => {
	it("nests replies under their direct parent", () => {
		const model = buildThread([entry("a"), reply("b", "a"), reply("c", "b"), reply("d", "a")]);
		expect(names(model.roots)).toEqual(["a"]);
		const a = model.nodes.get(`${DIR}/a.md`);
		expect(names(a?.children ?? [])).toEqual(["b", "d"]);
		expect(names(model.nodes.get(`${DIR}/b.md`)?.children ?? [])).toEqual(["c"]);
		expect(model.issues).toEqual([]);
	});

	it("orders siblings by created, then message_id, then path", () => {
		const model = buildThread([
			entry("z", { created: "2026-10-01T09:00:00" }),
			entry("b", { created: "2026-10-01T09:00:00" }),
			entry("a", { created: "2026-10-01T11:00:00" }),
			entry("c", { created: "2026-10-01T08:00:00" }),
		]);
		expect(names(model.roots)).toEqual(["c", "b", "z", "a"]);
	});

	it("sorts a message with an unparsable timestamp after valid siblings and reports it", () => {
		const model = buildThread([entry("bad", { created: "nope" }), entry("ok")]);
		expect(names(model.roots)).toEqual(["ok", "bad"]);
		expect(kinds(model)).toEqual([`invalid-timestamp:${DIR}/bad.md`]);
	});

	it("keeps a reply attached when the parent path is resolved with a different link style", () => {
		const model = buildThread([
			entry("a"),
			entry("b", { parent: "[Parent](a.md)" }),
			entry("c", { parent: "[Parent](../messages/a.md)" }),
		]);
		expect(names(model.nodes.get(`${DIR}/a.md`)?.children ?? [])).toEqual(["b", "c"]);
	});

	it("reports a missing parent and never attaches the message elsewhere", () => {
		const model = buildThread([entry("a"), reply("b", "gone")]);
		expect(names(model.roots)).toEqual(["a"]);
		expect(names(model.orphans)).toEqual(["b"]);
		expect(kinds(model)).toEqual([`missing-parent:${DIR}/b.md`]);
	});

	it("treats a wikilink parent as an invalid file, not an orphan", () => {
		const model = buildThread([entry("a"), entry("b", { parent: "[[a]]" })]);
		expect(model.invalid.map((i) => i.path)).toEqual([`${DIR}/b.md`]);
		expect(model.orphans).toEqual([]);
		expect(kinds(model)).toEqual([`invalid-file:${DIR}/b.md`]);
	});

	it("reports a parent destination that cannot be resolved as an orphan", () => {
		const model = buildThread([
			entry("a"),
			entry("b", { parent: "[p](https://example.com/a.md)" }),
		]);
		expect(names(model.orphans)).toEqual(["b"]);
		expect(kinds(model)).toEqual([`invalid-link:${DIR}/b.md`]);
	});

	it("reports a parent outside the topic's messages folder", () => {
		const model = buildThread([
			entry("a"),
			entry("b", { parent: "[p](../../Other/messages/x.md)" }),
		]);
		expect(names(model.orphans)).toEqual(["b"]);
		expect(kinds(model)).toEqual([`parent-outside-topic:${DIR}/b.md`]);
	});

	it("reports a parent that is an invalid message file", () => {
		const model = buildThread([entry("bad", { status: "weird" }), reply("b", "bad")]);
		expect(names(model.orphans)).toEqual(["b"]);
		expect(model.invalid.map((i) => i.path)).toEqual([`${DIR}/bad.md`]);
		expect(kinds(model).sort()).toEqual(
			[`invalid-file:${DIR}/bad.md`, `parent-invalid:${DIR}/b.md`].sort(),
		);
	});

	it("reports a self-parent", () => {
		const model = buildThread([entry("a", { parent: "[p](./a.md)" })]);
		expect(names(model.orphans)).toEqual(["a"]);
		expect(kinds(model)).toEqual([`self-parent:${DIR}/a.md`]);
	});

	it("breaks a cycle without recursing forever and keeps non-members attached", () => {
		const model = buildThread([reply("a", "c"), reply("b", "a"), reply("c", "b"), reply("d", "c")]);
		expect(names(model.orphans).sort()).toEqual(["a", "b", "c"]);
		expect(kinds(model).filter((k) => k.startsWith("cycle")).length).toBe(3);
		expect(names(model.nodes.get(`${DIR}/c.md`)?.children ?? [])).toEqual(["d"]);
		const walk = (n: { children: unknown[] }, depth = 0): number =>
			depth > 20 ? depth : Math.max(depth, ...n.children.map((c) => walk(c as never, depth + 1)));
		for (const o of model.orphans) expect(walk(o)).toBeLessThan(20);
	});

	it("flags duplicate message ids on every holder", () => {
		const model = buildThread([
			entry("a", { message_id: "msg-same" }),
			entry("b", { message_id: "msg-same" }),
		]);
		expect(kinds(model).sort()).toEqual([`duplicate-id:${DIR}/a.md`, `duplicate-id:${DIR}/b.md`]);
		expect(names(model.roots)).toEqual(["a", "b"]);
	});

	it("never throws on arbitrary broken input", () => {
		const entries: MessageEntry[] = [
			{ path: `${DIR}/x.md`, props: null, problems: ["type is wrong"], warnings: [] },
			entry("a", { parent: "[x](<>)" }),
			entry("b", { parent: "[x](https://example.com/a.md)" }),
			entry("c", { parent: "[x](../../../../a.md)" }),
		];
		expect(() => buildThread(entries)).not.toThrow();
		expect(buildThread(entries).orphans.length).toBe(2);
		expect(buildThread(entries).invalid.length).toBe(2);
	});
});

describe("visibility", () => {
	it("shows a message only when it and every ancestor are published", () => {
		const model = buildThread([
			entry("a"),
			reply("b", "a", { status: "removed" }),
			reply("c", "b"),
			entry("d", { status: "draft" }),
			reply("e", "d"),
			reply("f", "a"),
		]);
		const hidden = (f: string) => model.nodes.get(`${DIR}/${f}.md`)?.hiddenReason;
		expect(hidden("a")).toBeNull();
		expect(hidden("f")).toBeNull();
		expect(hidden("b")).toBe("removed");
		expect(hidden("c")).toBe("ancestor");
		expect(hidden("d")).toBe("draft");
		expect(hidden("e")).toBe("ancestor");
	});

	it("hides orphans and their descendants from the normal view", () => {
		const model = buildThread([reply("b", "gone"), reply("c", "b")]);
		expect(model.nodes.get(`${DIR}/b.md`)?.hiddenReason).toBe("orphan");
		expect(model.nodes.get(`${DIR}/c.md`)?.hiddenReason).toBe("ancestor");
	});

	it("lists drafts for the drafts view", () => {
		const model = buildThread([
			entry("a"),
			entry("d", { status: "draft" }),
			reply("e", "a", { status: "draft" }),
		]);
		expect(names(model.drafts)).toEqual(["d", "e"]);
	});
});
