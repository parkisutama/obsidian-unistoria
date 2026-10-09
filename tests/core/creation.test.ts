// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { cleanupCreated, runPlan, type VaultIO } from "../../src/core/creation/execute";
import { planTopic, type TopicPlan } from "../../src/core/creation/plan";
import { parseLink, resolveDestination } from "../../src/core/links/links";
import { parseMessageProps, parseTopicProps } from "../../src/core/schema/schema";

const NOW = new Date(2026, 9, 1, 10, 30, 0);

function plan(over: Partial<Parameters<typeof planTopic>[0]> = {}): TopicPlan {
	const result = planTopic({
		spacePath: "Spaces/Alpha",
		title: "Topic Name",
		now: NOW,
		topicId: "topic-aaaaaaaaaaaa",
		messageId: "msg-bbbbbbbbbbbb",
		...over,
	});
	if (!result.ok) throw new Error(`plan failed: ${result.reason}`);
	return result.plan;
}

class FakeVault implements VaultIO {
	folders = new Set<string>();
	files = new Map<string, string>();
	failOn: string | null = null;
	log: string[] = [];

	constructor(initial: { folders?: string[]; files?: Record<string, string> } = {}) {
		for (const f of initial.folders ?? []) this.folders.add(f);
		for (const [p, c] of Object.entries(initial.files ?? {})) this.files.set(p, c);
	}
	async kind(path: string) {
		return this.folders.has(path) ? "folder" : this.files.has(path) ? "file" : null;
	}
	async createFolder(path: string) {
		if (this.failOn === path) throw new Error(`disk full at ${path}`);
		this.folders.add(path);
		this.log.push(`mkdir ${path}`);
	}
	async createFile(path: string, content: string) {
		if (this.failOn === path) throw new Error(`disk full at ${path}`);
		this.files.set(path, content);
		this.log.push(`write ${path}`);
	}
	async readFile(path: string) {
		const content = this.files.get(path);
		if (content === undefined) throw new Error(`no such file ${path}`);
		return content;
	}
	async list(path: string) {
		const prefix = `${path}/`;
		return [...this.folders, ...this.files.keys()].filter(
			(p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"),
		);
	}
	async remove(path: string) {
		this.folders.delete(path);
		this.files.delete(path);
		this.log.push(`remove ${path}`);
	}
}

describe("planTopic", () => {
	it("lays out the folder, Folder Note, messages folder, and first draft", () => {
		const p = plan();
		expect(p.folderPath).toBe("Spaces/Alpha/Topic Name");
		expect(p.notePath).toBe("Spaces/Alpha/Topic Name/Topic Name.md");
		expect(p.messagesPath).toBe("Spaces/Alpha/Topic Name/messages");
		expect(p.messagePath).toBe("Spaces/Alpha/Topic Name/messages/2026-10-01T103000-bbbbbb.md");
		expect(p.steps.map((s) => s.kind)).toEqual(["folder", "file", "folder", "file"]);
		expect(p.steps.map((s) => s.path)).toEqual([
			p.folderPath,
			p.notePath,
			p.messagesPath,
			p.messagePath,
		]);
	});

	it("writes a valid Folder Note with the description as its body", () => {
		const p = plan({ description: "Why we talk about this." });
		const note = (p.steps[1] as { content: string }).content;
		expect(note).toBe(
			[
				"---",
				"type: discussion-topic",
				"topic_id: topic-aaaaaaaaaaaa",
				"status: open",
				"created: 2026-10-01T10:30:00",
				"updated: 2026-10-01T10:30:00",
				"---",
				"",
				"Why we talk about this.",
				"",
			].join("\n"),
		);
	});

	it("writes a draft root message that satisfies the schema and links to the Folder Note", () => {
		const p = plan();
		const text = (p.steps[3] as { content: string }).content;
		expect(text).toBe(
			[
				"---",
				"type: discussion-message",
				"message_id: msg-bbbbbbbbbbbb",
				'topic: "[Topic Name](../Topic%20Name.md)"',
				'parent: ""',
				"status: draft",
				"created: 2026-10-01T10:30:00",
				"updated: 2026-10-01T10:30:00",
				'author: ""',
				"---",
				"",
				"",
			].join("\n"),
		);
		const fm = {
			type: "discussion-message",
			message_id: "msg-bbbbbbbbbbbb",
			topic: "[Topic Name](../Topic%20Name.md)",
			parent: "",
			status: "draft",
			created: "2026-10-01T10:30:00",
			updated: "2026-10-01T10:30:00",
			author: "",
		};
		expect(parseMessageProps(fm).ok).toBe(true);
		const link = parseLink(fm.topic);
		expect(link.ok && resolveDestination(p.messagePath, link.destination)).toEqual({
			ok: true,
			path: p.notePath,
		});
	});

	it("produces a Folder Note the schema accepts", () => {
		expect(
			parseTopicProps({
				type: "discussion-topic",
				topic_id: "topic-aaaaaaaaaaaa",
				status: "open",
				created: "2026-10-01T10:30:00",
				updated: "2026-10-01T10:30:00",
			}).ok,
		).toBe(true);
	});

	it("sanitizes the title and says so", () => {
		const p = plan({ title: "Plan #1: [draft]" });
		expect(p.topicName).toBe("Plan 1 draft");
		expect(p.titleChanged).toBe(true);
		expect(plan().titleChanged).toBe(false);
	});

	it("builds links that survive special characters in the title", () => {
		const p = plan({ title: "100% & Tópik" });
		const text = (p.steps[3] as { content: string }).content;
		expect(text).toContain('topic: "[100% & Tópik](../100%25%20&%20Tópik.md)"');
	});

	it("works without a Space folder", () => {
		const p = plan({ spacePath: "" });
		expect(p.folderPath).toBe("Topic Name");
		expect(p.notePath).toBe("Topic Name/Topic Name.md");
	});

	it("rejects an unusable title", () => {
		expect(planTopic({ spacePath: "", title: "###", now: NOW })).toEqual({
			ok: false,
			reason: "empty",
		});
		expect(planTopic({ spacePath: "", title: "con", now: NOW })).toEqual({
			ok: false,
			reason: "reserved",
		});
	});

	it("generates ids when none are given", () => {
		const result = planTopic({ spacePath: "", title: "A", now: NOW });
		expect(result.ok && result.plan.topicId).toMatch(/^topic-[0-9a-f]{12}$/);
		expect(result.ok && result.plan.messageId).toMatch(/^msg-[0-9a-f]{12}$/);
	});

	it("quotes a description-free note with no trailing text", () => {
		const note = (plan().steps[1] as { content: string }).content;
		expect(note.endsWith("---\n")).toBe(true);
	});
});

describe("runPlan", () => {
	it("creates everything in order on an empty vault", async () => {
		const vault = new FakeVault({ folders: ["Spaces", "Spaces/Alpha"] });
		const p = plan();
		const result = await runPlan(p, vault);
		expect(result).toEqual({
			ok: true,
			created: p.steps.map((s) => ({
				kind: s.kind,
				path: s.path,
				content: s.kind === "file" ? s.content : undefined,
			})),
		});
		expect(vault.log).toEqual([
			`mkdir ${p.folderPath}`,
			`write ${p.notePath}`,
			`mkdir ${p.messagesPath}`,
			`write ${p.messagePath}`,
		]);
	});

	it("does not overwrite an existing topic folder and writes nothing", async () => {
		const vault = new FakeVault({ folders: ["Spaces/Alpha", "Spaces/Alpha/Topic Name"] });
		const result = await runPlan(plan(), vault);
		expect(result).toMatchObject({
			ok: false,
			reason: "conflict",
			path: "Spaces/Alpha/Topic Name",
			created: [],
		});
		expect(vault.log).toEqual([]);
	});

	it("does not overwrite an existing file with the same path", async () => {
		const vault = new FakeVault({ files: { "Spaces/Alpha/Topic Name": "x" } });
		const result = await runPlan(plan(), vault);
		expect(result).toMatchObject({ ok: false, reason: "conflict" });
		expect(vault.log).toEqual([]);
	});

	it("reports what was created when a write fails part-way", async () => {
		const vault = new FakeVault();
		const p = plan();
		vault.failOn = p.messagesPath;
		const result = await runPlan(p, vault);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		if (result.reason !== "write-failed") throw new Error("expected write-failed");
		expect(result.path).toBe(p.messagesPath);
		expect(result.error).toContain("disk full");
		expect(result.created.map((c) => c.path)).toEqual([p.folderPath, p.notePath]);
	});

	it("resumes the same plan after a failure and skips what already exists", async () => {
		const vault = new FakeVault();
		const p = plan();
		vault.failOn = p.messagePath;
		const first = await runPlan(p, vault);
		expect(first.ok).toBe(false);
		vault.failOn = null;
		vault.log = [];
		const second = await runPlan(p, vault, { resume: true });
		expect(second.ok).toBe(true);
		expect(vault.log).toEqual([`write ${p.messagePath}`]);
		expect(vault.files.get(p.messagePath)).toBe((p.steps[3] as { content: string }).content);
	});

	it("refuses to resume over a different topic that uses the same folder", async () => {
		const vault = new FakeVault();
		const mine = plan();
		await runPlan(mine, vault);
		const other = plan({ topicId: "topic-cccccccccccc", messageId: "msg-dddddddddddd" });
		const result = await runPlan(other, vault, { resume: true });
		expect(result).toMatchObject({ ok: false, reason: "conflict" });
	});
});

describe("cleanupCreated", () => {
	it("removes only unchanged files and then empty folders, newest first", async () => {
		const vault = new FakeVault();
		const p = plan();
		vault.failOn = p.messagesPath;
		const failed = await runPlan(p, vault);
		if (failed.ok) throw new Error("expected failure");
		const outcome = await cleanupCreated(failed.created, vault);
		expect(outcome).toEqual({ removed: [p.notePath, p.folderPath], kept: [] });
		expect(vault.files.size).toBe(0);
		expect(vault.folders.has(p.folderPath)).toBe(false);
	});

	it("keeps a file the user has edited and the folder that still holds it", async () => {
		const vault = new FakeVault();
		const p = plan();
		vault.failOn = p.messagesPath;
		const failed = await runPlan(p, vault);
		if (failed.ok) throw new Error("expected failure");
		vault.files.set(p.notePath, `${vault.files.get(p.notePath)}\nUser notes\n`);
		const outcome = await cleanupCreated(failed.created, vault);
		expect(outcome.removed).toEqual([]);
		expect(outcome.kept).toEqual([p.notePath, p.folderPath]);
		expect(vault.files.has(p.notePath)).toBe(true);
	});
});
