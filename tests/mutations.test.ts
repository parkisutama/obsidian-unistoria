// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { bodyOf } from "../src/core/schema/frontmatter";
import { isTopicMessagePath, topicFolderOf } from "../src/core/thread/boundary";
import { type MutationHost, setMessageStatus } from "../src/platform/vault/mutations";

const TOPIC = "Spaces/A/Topic Name";
const PATH = `${TOPIC}/messages/2026-10-01T103000-abc123.md`;

const fm = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
	type: "discussion-message",
	message_id: "msg-abc123def456",
	topic: "[Topic Name](../Topic%20Name.md)",
	parent: "",
	status: "draft",
	created: "2026-10-01T10:30:00",
	updated: "2026-10-01T10:30:00",
	author: "",
	extra_key: "keep me",
	...over,
});

function host(initial: {
	fm?: Record<string, unknown> | null | undefined;
	text?: string;
	exists?: boolean;
}) {
	const state = {
		fm: "fm" in initial ? initial.fm : fm(),
		text: initial.text ?? "---\n---\n\nHello\n",
		writes: 0,
		failWrite: false,
		concurrentChange: false,
	};
	const h: MutationHost = {
		exists: () => initial.exists ?? true,
		readText: async () => state.text,
		frontmatter: () => state.fm ?? undefined,
		updateFrontmatter: async (_path, mutate) => {
			if (state.failWrite) throw new Error("disk error");
			if (state.concurrentChange && state.fm) state.fm.status = "removed";
			const copy = { ...(state.fm ?? {}) };
			mutate(copy);
			state.fm = copy;
			state.writes++;
		},
		now: () => new Date(2026, 9, 1, 11, 0, 0),
	};
	return { h, state };
}

describe("boundary", () => {
	it("accepts only markdown files directly inside the topic's messages folder", () => {
		expect(isTopicMessagePath(TOPIC, PATH)).toBe(true);
		expect(isTopicMessagePath(TOPIC, `${TOPIC}/${"Topic Name"}.md`)).toBe(false);
		expect(isTopicMessagePath(TOPIC, `${TOPIC}/messages/sub/x.md`)).toBe(false);
		expect(isTopicMessagePath(TOPIC, `${TOPIC}/messages/x.png`)).toBe(false);
		expect(isTopicMessagePath(TOPIC, "Spaces/A/Other/messages/x.md")).toBe(false);
		expect(isTopicMessagePath(TOPIC, `${TOPIC}/messages/../x.md`)).toBe(false);
		expect(isTopicMessagePath("", "messages/x.md")).toBe(true);
	});

	it("finds the topic folder of a note or a message path", () => {
		expect(topicFolderOf(PATH)).toBe(TOPIC);
		expect(topicFolderOf(`${TOPIC}/Topic Name.md`)).toBe(TOPIC);
		expect(topicFolderOf("loose.md")).toBe("");
	});
});

describe("bodyOf", () => {
	it("returns text after the frontmatter, with LF or CRLF", () => {
		expect(bodyOf("---\na: 1\n---\n\nHello\n")).toBe("\nHello\n");
		expect(bodyOf("---\r\na: 1\r\n---\r\n\r\nHello")).toBe("\r\nHello");
	});

	it("returns the whole text when there is no frontmatter", () => {
		expect(bodyOf("Just text")).toBe("Just text");
		expect(bodyOf("--- not frontmatter\ntext")).toBe("--- not frontmatter\ntext");
	});

	it("treats a frontmatter-only file as an empty body", () => {
		expect(bodyOf("---\na: 1\n---\n")).toBe("");
		expect(bodyOf("---\na: 1\n---")).toBe("");
	});
});

describe("setMessageStatus", () => {
	it("publishes a draft, changing only status and updated", async () => {
		const { h, state } = host({});
		expect(await setMessageStatus(h, TOPIC, PATH, "published")).toEqual({ ok: true });
		expect(state.fm).toEqual({ ...fm(), status: "published", updated: "2026-10-01T11:00:00" });
		expect(state.fm?.extra_key).toBe("keep me");
		expect(state.fm?.created).toBe("2026-10-01T10:30:00");
	});

	it("removes and restores a published message", async () => {
		const { h, state } = host({ fm: fm({ status: "published" }) });
		expect(await setMessageStatus(h, TOPIC, PATH, "removed")).toEqual({ ok: true });
		expect(state.fm?.status).toBe("removed");
		expect(await setMessageStatus(h, TOPIC, PATH, "published")).toEqual({ ok: true });
		expect(state.fm?.status).toBe("published");
	});

	it("refuses an empty body and writes nothing", async () => {
		const { h, state } = host({ text: "---\n---\n  \n" });
		expect(await setMessageStatus(h, TOPIC, PATH, "published")).toMatchObject({
			ok: false,
			reason: "empty-body",
		});
		expect(state.writes).toBe(0);
	});

	it("refuses transitions that are not allowed", async () => {
		const { h, state } = host({});
		expect(await setMessageStatus(h, TOPIC, PATH, "removed")).toMatchObject({
			ok: false,
			reason: "not-allowed",
		});
		expect(state.writes).toBe(0);
	});

	it("refuses files outside the topic boundary, whatever their content", async () => {
		const { h, state } = host({});
		const outside = "Spaces/A/Other/messages/x.md";
		expect(await setMessageStatus(h, TOPIC, outside, "published")).toMatchObject({
			ok: false,
			reason: "outside-topic",
		});
		expect(state.writes).toBe(0);
	});

	it("reports a missing file", async () => {
		const { h } = host({ exists: false });
		expect(await setMessageStatus(h, TOPIC, PATH, "published")).toMatchObject({
			ok: false,
			reason: "not-found",
		});
	});

	it("never mutates an invalid file", async () => {
		const { h, state } = host({ fm: fm({ status: "archived" }) });
		const result = await setMessageStatus(h, TOPIC, PATH, "published");
		expect(result).toMatchObject({ ok: false, reason: "invalid-file" });
		expect(state.writes).toBe(0);
	});

	it("does not guess when the metadata cache is not ready", async () => {
		const { h, state } = host({ fm: undefined });
		expect(await setMessageStatus(h, TOPIC, PATH, "published")).toMatchObject({
			ok: false,
			reason: "not-ready",
		});
		expect(state.writes).toBe(0);
	});

	it("aborts when the status changed between the check and the write", async () => {
		const { h, state } = host({});
		state.concurrentChange = true;
		const result = await setMessageStatus(h, TOPIC, PATH, "published");
		expect(result).toMatchObject({ ok: false, reason: "changed" });
		expect(state.fm?.status).toBe("removed");
	});

	it("reports a failed write", async () => {
		const { h, state } = host({});
		state.failWrite = true;
		expect(await setMessageStatus(h, TOPIC, PATH, "published")).toMatchObject({
			ok: false,
			reason: "write-failed",
			detail: "disk error",
		});
	});
});
