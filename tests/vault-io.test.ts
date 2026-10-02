import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import { runPlan } from "../src/core/creation/execute";
import { planTopic } from "../src/core/creation/plan";
import { createVaultIO, ensureFolder } from "../src/platform/vault/vault-io";

/** A tiny in-memory stand-in for the parts of the Obsidian vault the adapter uses. */
function fakeApp() {
	const entries = new Map<
		string,
		{ path: string; children?: { path: string }[]; content?: string }
	>();
	const parentOf = (p: string) => p.split("/").slice(0, -1).join("/");
	const add = (path: string, folder: boolean, content?: string) => {
		if (entries.has(path)) throw new Error("File already exists.");
		const parent = parentOf(path);
		if (parent !== "" && !entries.get(parent)?.children) throw new Error("Parent folder missing");
		const entry = folder ? { path, children: [] } : { path, content };
		entries.set(path, entry);
		entries.get(parent)?.children?.push(entry);
		return entry;
	};
	const app = {
		vault: {
			getAbstractFileByPath: (p: string) => entries.get(p) ?? null,
			createFolder: async (p: string) => void add(p, true),
			create: async (p: string, c: string) => void add(p, false, c),
			read: async (f: { content: string }) => f.content,
		},
		fileManager: {
			trashFile: async (f: { path: string }) => {
				entries.delete(f.path);
				const parent = entries.get(parentOf(f.path));
				if (parent?.children) parent.children = parent.children.filter((c) => c.path !== f.path);
			},
		},
	};
	return { app: app as unknown as App, entries };
}

describe("createVaultIO", () => {
	it("reports kinds, reads, lists, and removes", async () => {
		const { app } = fakeApp();
		const io = createVaultIO(app);
		await io.createFolder("A");
		await io.createFile("A/x.md", "hello");
		expect(await io.kind("A")).toBe("folder");
		expect(await io.kind("A/x.md")).toBe("file");
		expect(await io.kind("nope")).toBeNull();
		expect(await io.readFile("A/x.md")).toBe("hello");
		expect(await io.list("A")).toEqual(["A/x.md"]);
		await io.remove("A/x.md");
		expect(await io.kind("A/x.md")).toBeNull();
		await expect(io.readFile("A")).rejects.toThrow();
	});

	it("runs a topic plan end to end", async () => {
		const { app, entries } = fakeApp();
		await ensureFolder(app, "Spaces/Alpha");
		const result = planTopic({
			spacePath: "Spaces/Alpha",
			title: "Topic Name",
			now: new Date(2026, 9, 1, 10, 30),
		});
		if (!result.ok) throw new Error("plan");
		const run = await runPlan(result.plan, createVaultIO(app));
		expect(run.ok).toBe(true);
		expect(entries.has(result.plan.messagePath)).toBe(true);
		expect(entries.get(result.plan.notePath)?.content).toContain("type: discussion-topic");
	});
});

describe("ensureFolder", () => {
	it("creates missing ancestors and leaves existing folders alone", async () => {
		const { app, entries } = fakeApp();
		await ensureFolder(app, "a/b/c");
		expect([...entries.keys()]).toEqual(["a", "a/b", "a/b/c"]);
		await ensureFolder(app, "a/b");
		expect(entries.size).toBe(3);
	});

	it("refuses when a file is in the way", async () => {
		const { app } = fakeApp();
		await createVaultIO(app).createFile("a", "x");
		await expect(ensureFolder(app, "a/b")).rejects.toThrow(/file already exists/i);
	});
});
