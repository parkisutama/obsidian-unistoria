// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { parseMessageProps, parseTopicProps } from "../../src/core/schema/schema";

const message = (over: Record<string, unknown> = {}) => ({
	type: "discussion-message",
	message_id: "msg-abc123def456",
	topic: "[Topic Name](../Topic%20Name.md)",
	parent: "",
	status: "draft",
	created: "2026-10-01T10:30:00",
	updated: "2026-10-01T10:30:00",
	author: "",
	...over,
});

const topic = (over: Record<string, unknown> = {}) => ({
	type: "discussion-topic",
	topic_id: "topic-abc123def456",
	status: "open",
	created: "2026-10-01T10:30:00",
	updated: "2026-10-01T10:45:00",
	...over,
});

describe("parseMessageProps", () => {
	it("accepts a root message", () => {
		const result = parseMessageProps(message());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toMatchObject({
			messageId: "msg-abc123def456",
			parent: "",
			status: "draft",
			author: "",
			createdMs: Date.UTC(2026, 9, 1, 10, 30, 0),
		});
		expect(result.warnings).toEqual([]);
	});

	it("accepts a reply and a missing author", () => {
		const { author: _author, ...rest } = message({
			parent: "[Parent message](./a.md)",
			status: "published",
		});
		const result = parseMessageProps(rest);
		expect(result.ok && result.value.author).toBe("");
		expect(result.ok && result.value.parent).toBe("[Parent message](./a.md)");
	});

	it("preserves nothing it does not know: unknown keys are ignored, not an error", () => {
		expect(parseMessageProps(message({ extra: 1, tags: ["a"] })).ok).toBe(true);
	});

	it.each([
		["type", { type: "other" }],
		["message_id", { message_id: "abc" }],
		["message_id", { message_id: 5 }],
		["status", { status: "archived" }],
		["status", { status: undefined }],
		["topic", { topic: "../Topic Name.md" }],
		["topic", { topic: "[[Topic Name]]" }],
		["topic", { topic: undefined }],
		["parent", { parent: "../a.md" }],
		["parent", { parent: undefined }],
		["parent", { parent: 3 }],
		["created", { created: undefined }],
		["updated", { updated: undefined }],
	])("is invalid when %s is wrong", (key, over) => {
		const result = parseMessageProps(message(over));
		expect(result.ok).toBe(false);
		expect(!result.ok && result.problems.some((p) => p.startsWith(key))).toBe(true);
	});

	it("reports every problem at once", () => {
		const result = parseMessageProps({});
		expect(!result.ok && result.problems.length).toBeGreaterThanOrEqual(6);
	});

	it("keeps a message with an unparsable timestamp, with a warning and no time", () => {
		const result = parseMessageProps(
			message({ created: "yesterday", updated: "2026-10-01T10:30:00+07:00" }),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.createdMs).toBeNull();
		expect(result.value.updatedMs).toBeNull();
		expect(result.warnings).toEqual([
			"created is not a valid date and time",
			"updated is not a valid date and time",
		]);
	});

	it("warns about a non-text author", () => {
		const result = parseMessageProps(message({ author: 5 }));
		expect(result.ok && result.value.author).toBe("");
		expect(result.ok && result.warnings).toEqual(["author should be text"]);
	});
});

describe("parseTopicProps", () => {
	it("accepts a topic", () => {
		const result = parseTopicProps(topic());
		expect(result.ok && result.value).toMatchObject({
			topicId: "topic-abc123def456",
			status: "open",
		});
	});

	it.each([
		["type", { type: "discussion-message" }],
		["topic_id", { topic_id: "msg-1" }],
		["status", { status: "draft" }],
		["created", { created: undefined }],
	])("is invalid when %s is wrong", (key, over) => {
		const result = parseTopicProps(topic(over));
		expect(!result.ok && result.problems.some((p) => p.startsWith(key))).toBe(true);
	});
});
