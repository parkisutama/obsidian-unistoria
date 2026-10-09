// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { type MutationHost, setTopicStatus } from "../src/platform/vault/mutations";

const TOPIC = "Spaces/A/Topic Name";
const NOTE = `${TOPIC}/Topic Name.md`;

const fm = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
	type: "discussion-topic",
	topic_id: "topic-aaaaaaaaaaaa",
	status: "open",
	created: "2026-10-01T10:00:00",
	updated: "2026-10-01T10:00:00",
	extra: "keep",
	...over,
});

function host(initial: Record<string, unknown> | undefined = fm()) {
	const state: { fm: Record<string, unknown> | undefined; writes: number; fail: boolean } = {
		fm: initial,
		writes: 0,
		fail: false,
	};
	const h: MutationHost = {
		exists: () => true,
		readText: async () => "",
		frontmatter: () => state.fm,
		updateFrontmatter: async (_p, mutate) => {
			if (state.fail) throw new Error("disk error");
			const copy = { ...(state.fm ?? {}) };
			mutate(copy);
			state.fm = copy;
			state.writes++;
		},
		now: () => new Date(2026, 9, 2, 7, 0, 0),
	};
	return { h, state };
}

describe("setTopicStatus", () => {
	it("closes and reopens a topic, changing only status and updated", async () => {
		const { h, state } = host();
		expect(await setTopicStatus(h, TOPIC, NOTE, "closed")).toEqual({ ok: true });
		expect(state.fm).toEqual({ ...fm(), status: "closed", updated: "2026-10-02T07:00:00" });
		expect(await setTopicStatus(h, TOPIC, NOTE, "open")).toEqual({ ok: true });
		expect(state.fm?.status).toBe("open");
		expect(state.fm?.created).toBe("2026-10-01T10:00:00");
	});

	it("does not write when the status is already the requested one", async () => {
		const { h, state } = host();
		expect(await setTopicStatus(h, TOPIC, NOTE, "open")).toEqual({ ok: true });
		expect(state.writes).toBe(0);
	});

	it("refuses a note outside the topic folder", async () => {
		const { h, state } = host();
		expect(await setTopicStatus(h, TOPIC, "Spaces/A/Other/Other.md", "closed")).toMatchObject({
			ok: false,
			reason: "outside-topic",
		});
		expect(await setTopicStatus(h, TOPIC, `${TOPIC}/messages/x.md`, "closed")).toMatchObject({
			ok: false,
			reason: "outside-topic",
		});
		expect(state.writes).toBe(0);
	});

	it("refuses an invalid Folder Note and an unindexed one", async () => {
		expect(
			await setTopicStatus(host(fm({ status: "weird" })).h, TOPIC, NOTE, "closed"),
		).toMatchObject({
			ok: false,
			reason: "invalid-file",
		});
		const unindexed = host();
		unindexed.state.fm = undefined;
		expect(await setTopicStatus(unindexed.h, TOPIC, NOTE, "closed")).toMatchObject({
			ok: false,
			reason: "not-ready",
		});
	});

	it("reports a failed write", async () => {
		const { h, state } = host();
		state.fail = true;
		expect(await setTopicStatus(h, TOPIC, NOTE, "closed")).toMatchObject({
			ok: false,
			reason: "write-failed",
			detail: "disk error",
		});
	});
});
