import { describe, expect, it } from "vitest";
import { createDraftMessage } from "../src/platform/vault/messages";
import { createMutationHost, setMessageStatus } from "../src/platform/vault/mutations";
import { createVaultIO, ensureFolder } from "../src/platform/vault/vault-io";
import { fakeApp } from "./fixtures/fake-app";

const NOW = new Date(2026, 9, 2, 9, 0, 0);

describe("createDraftMessage", () => {
	it("writes a draft reply file inside the topic's messages folder", async () => {
		const { app, entries } = fakeApp();
		await ensureFolder(app, "S/T/messages");
		const result = await createDraftMessage(app, {
			topicFolder: "S/T",
			notePath: "S/T/T.md",
			parentPath: "S/T/messages/p.md",
			now: NOW,
			author: "Parkis",
			messageId: "msg-aaaaaaaaaaaa",
		});
		expect(result).toEqual({
			ok: true,
			path: "S/T/messages/2026-10-02T090000-aaaaaa.md",
			messageId: "msg-aaaaaaaaaaaa",
		});
		const text = entries.get("S/T/messages/2026-10-02T090000-aaaaaa.md")?.content ?? "";
		expect(text).toContain("status: draft");
		expect(text).toContain('author: "Parkis"');
		expect(text).toContain('parent: "[Parent message](./p.md)"');
	});

	it("never overwrites an existing file", async () => {
		const { app, entries } = fakeApp();
		await ensureFolder(app, "S/T/messages");
		const input = {
			topicFolder: "S/T",
			notePath: "S/T/T.md",
			parentPath: null,
			now: NOW,
			messageId: "msg-aaaaaaaaaaaa",
		};
		await createDraftMessage(app, input);
		const path = "S/T/messages/2026-10-02T090000-aaaaaa.md";
		const written = entries.get(path);
		if (written) written.content = "edited by the user";
		const second = await createDraftMessage(app, input);
		expect(second).toMatchObject({ ok: false });
		expect(entries.get(path)?.content).toBe("edited by the user");
	});

	it("reports a missing folder instead of throwing", async () => {
		const { app } = fakeApp();
		const result = await createDraftMessage(app, {
			topicFolder: "Missing/T",
			notePath: "Missing/T/T.md",
			parentPath: null,
			now: NOW,
		});
		expect(result).toMatchObject({ ok: false });
	});
});

describe("createMutationHost", () => {
	const message = {
		type: "discussion-message",
		message_id: "msg-abc123def456",
		topic: "[T](../T.md)",
		parent: "",
		status: "draft",
		created: "2026-10-02T08:00:00",
		updated: "2026-10-02T08:00:00",
		author: "",
		extra: "keep",
	};

	async function setup() {
		const harness = fakeApp();
		await ensureFolder(harness.app, "S/T/messages");
		const path = "S/T/messages/m.md";
		await createVaultIO(harness.app).createFile(path, "---\n---\n\nHello\n");
		const entry = harness.entries.get(path);
		if (entry) entry.frontmatter = { ...message };
		return { ...harness, path };
	}

	it("reads frontmatter without the position field, and reports an unindexed file as undefined", async () => {
		const { app, entries, path } = await setup();
		const host = createMutationHost(app);
		expect(host.frontmatter(path)).toEqual(message);
		const entry = entries.get(path);
		if (entry) entry.frontmatter = undefined;
		expect(host.frontmatter(path)).toBeUndefined();
		expect(host.frontmatter("S/T/messages/nope.md")).toBeUndefined();
	});

	it("reads text, tells whether a file exists, and publishes through the frontmatter API", async () => {
		const { app, entries, path } = await setup();
		const host = createMutationHost(app);
		expect(host.exists(path)).toBe(true);
		expect(host.exists("S/T/messages/nope.md")).toBe(false);
		expect(await host.readText(path)).toContain("Hello");
		await expect(host.readText("S/T/messages/nope.md")).rejects.toThrow(/Not found/);

		expect(await setMessageStatus(host, "S/T", path, "published")).toEqual({ ok: true });
		const fm = entries.get(path)?.frontmatter;
		expect(fm?.status).toBe("published");
		expect(fm?.extra).toBe("keep");
		expect(host.now()).toBeInstanceOf(Date);
	});

	it("surfaces a frontmatter write failure", async () => {
		const { app, state, path } = await setup();
		state.processFails = true;
		expect(await setMessageStatus(createMutationHost(app), "S/T", path, "published")).toMatchObject(
			{
				ok: false,
				reason: "write-failed",
			},
		);
	});
});
