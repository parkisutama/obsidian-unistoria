// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { toggleBodyTask } from "../src/platform/vault/tasks";
import { createVaultIO, ensureFolder } from "../src/platform/vault/vault-io";
import { fakeApp } from "./fixtures/fake-app";

const TOPIC = { folder: "S/T", notePath: "S/T/T.md" };
const MESSAGE = "S/T/messages/m.md";

async function setup(body = "- [ ] one\n- [x] two\n") {
	const harness = fakeApp();
	await ensureFolder(harness.app, "S/T/messages");
	const io = createVaultIO(harness.app);
	await io.createFile(TOPIC.notePath, "---\ntype: discussion-topic\n---\n\n- [ ] context task\n");
	await io.createFile(MESSAGE, `---\ntype: discussion-message\n---\n\n${body}`);
	return harness;
}

describe("toggleBodyTask", () => {
	it("flips one checkbox in a message and nothing else", async () => {
		const { app, entries } = await setup();
		expect(await toggleBodyTask(app, TOPIC, MESSAGE, 0, false)).toEqual({ ok: true });
		expect(entries.get(MESSAGE)?.content).toBe(
			"---\ntype: discussion-message\n---\n\n- [x] one\n- [x] two\n",
		);
	});

	it("works on the topic's Folder Note", async () => {
		const { app, entries } = await setup();
		expect(await toggleBodyTask(app, TOPIC, TOPIC.notePath, 0, false)).toEqual({ ok: true });
		expect(entries.get(TOPIC.notePath)?.content).toContain("- [x] context task");
	});

	it("refuses a stale click and leaves the file alone", async () => {
		const { app, entries } = await setup();
		const before = entries.get(MESSAGE)?.content;
		expect(await toggleBodyTask(app, TOPIC, MESSAGE, 0, true)).toEqual({
			ok: false,
			reason: "changed",
		});
		expect(await toggleBodyTask(app, TOPIC, MESSAGE, 9, false)).toEqual({
			ok: false,
			reason: "changed",
		});
		expect(entries.get(MESSAGE)?.content).toBe(before);
	});

	it("refuses files outside the topic and files that do not exist", async () => {
		const { app } = await setup();
		await createVaultIO(app).createFolder("S/Other");
		await createVaultIO(app).createFile("S/Other/x.md", "- [ ] a\n");
		expect(await toggleBodyTask(app, TOPIC, "S/Other/x.md", 0, false)).toEqual({
			ok: false,
			reason: "outside-topic",
		});
		expect(await toggleBodyTask(app, TOPIC, "S/T/messages/none.md", 0, false)).toEqual({
			ok: false,
			reason: "not-found",
		});
	});

	it("reports a write failure", async () => {
		const { app, state } = await setup();
		state.processFails = true;
		expect(await toggleBodyTask(app, TOPIC, MESSAGE, 0, false)).toEqual({
			ok: false,
			reason: "write-failed",
		});
	});
});
