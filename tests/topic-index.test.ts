import { describe, expect, it } from "vitest";
import { type IndexHost, TopicIndex } from "../src/platform/index/topic-index";

type Fm = Record<string, unknown>;

const topicFm = (id = "topic-aaaaaaaaaaaa", over: Fm = {}): Fm => ({
	type: "discussion-topic",
	topic_id: id,
	status: "open",
	created: "2026-10-01T10:00:00",
	updated: "2026-10-01T10:00:00",
	...over,
});

const msgFm = (id: string, over: Fm = {}): Fm => ({
	type: "discussion-message",
	message_id: id,
	topic: "[Topic Name](../Topic%20Name.md)",
	parent: "",
	status: "published",
	created: "2026-10-01T10:30:00",
	updated: "2026-10-01T10:30:00",
	author: "",
	...over,
});

class FakeHost implements IndexHost {
	files = new Map<string, Fm | null | undefined>();
	/** Frontmatter the direct-read fallback returns for files the cache has not indexed. */
	direct = new Map<string, Fm | null>();
	markdownPaths() {
		return [...this.files.keys()];
	}
	exists(path: string) {
		return this.files.has(path);
	}
	frontmatter(path: string) {
		return this.files.get(path);
	}
	async readFrontmatter(path: string) {
		return this.direct.get(path) ?? null;
	}
}

const TOPIC = "Spaces/A/Topic Name";
const NOTE = `${TOPIC}/Topic Name.md`;
const m = (name: string) => `${TOPIC}/messages/${name}.md`;

function vault() {
	const host = new FakeHost();
	host.files.set(NOTE, topicFm());
	host.files.set(m("a"), msgFm("msg-a"));
	host.files.set(m("b"), msgFm("msg-b", { parent: "[p](./a.md)", created: "2026-10-01T10:40:00" }));
	host.files.set("Spaces/A/loose.md", { title: "unrelated" });
	host.files.set("Elsewhere/note.md", null);
	return host;
}

describe("TopicIndex.build", () => {
	it("finds topics from Folder Notes and builds their threads", async () => {
		const index = new TopicIndex(vault());
		await index.build();
		const topics = index.topics();
		expect(topics.map((t) => t.folderPath)).toEqual([TOPIC]);
		const topic = topics[0];
		expect(topic?.name).toBe("Topic Name");
		expect(topic?.spacePath).toBe("Spaces/A");
		expect(topic?.props?.status).toBe("open");
		expect(topic?.thread.roots.map((n) => n.path)).toEqual([m("a")]);
		expect(topic?.thread.nodes.get(m("a"))?.children.map((n) => n.path)).toEqual([m("b")]);
		expect(topic?.issues).toEqual([]);
	});

	it("sorts topics by space and name", async () => {
		const host = vault();
		host.files.set("Spaces/A/Alpha/Alpha.md", topicFm("topic-bbbbbbbbbbbb"));
		host.files.set("Spaces/Z/Beta/Beta.md", topicFm("topic-cccccccccccc"));
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topics().map((t) => t.name)).toEqual(["Alpha", "Topic Name", "Beta"]);
	});

	it("lists a topic with invalid properties and names the problems", async () => {
		const host = new FakeHost();
		host.files.set("S/T/T.md", topicFm("bad-id", { status: "weird" }));
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topics()).toHaveLength(1);
		expect(index.topics()[0]?.props).toBeNull();
		expect(index.topics()[0]?.problems.length).toBeGreaterThan(0);
	});

	it("shows a topic with no messages", async () => {
		const host = new FakeHost();
		host.files.set("S/T/T.md", topicFm());
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topics()[0]?.thread.roots).toEqual([]);
	});

	it("reads files the metadata cache has not indexed yet", async () => {
		const host = vault();
		host.files.set(m("c"), undefined);
		host.direct.set(m("c"), msgFm("msg-c", { created: "2026-10-01T11:00:00" }));
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topic(TOPIC)?.thread.nodes.has(m("c"))).toBe(true);
	});

	it("treats a file without properties in messages/ as invalid, not as a message", async () => {
		const host = vault();
		host.files.set(m("plain"), null);
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topic(TOPIC)?.thread.invalid.map((i) => i.path)).toEqual([m("plain")]);
	});

	it("ignores nested files and non-message folders", async () => {
		const host = vault();
		host.files.set(`${TOPIC}/messages/sub/x.md`, msgFm("msg-x"));
		host.files.set(`${TOPIC}/other/y.md`, msgFm("msg-y"));
		const index = new TopicIndex(host);
		await index.build();
		expect([...(index.topic(TOPIC)?.thread.nodes.keys() ?? [])].sort()).toEqual([m("a"), m("b")]);
	});
});

describe("integrity", () => {
	it("reports a topic link that no longer points at the Folder Note", async () => {
		const host = vault();
		host.files.set(m("a"), msgFm("msg-a", { topic: "[T](../Gone.md)" }));
		const index = new TopicIndex(host);
		await index.build();
		const kinds = index.topic(TOPIC)?.issues.map((i) => `${i.kind}:${i.path}`);
		expect(kinds).toEqual([`topic-link-broken:${m("a")}`]);
	});

	it("reports a topic link outside the topic", async () => {
		const host = vault();
		host.files.set(m("a"), msgFm("msg-a", { topic: "[T](../../Other/Other.md)" }));
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topic(TOPIC)?.issues.map((i) => i.kind)).toEqual(["topic-link-broken"]);
	});

	it("notes a Folder Note whose name differs from its folder, without calling links broken", async () => {
		const host = new FakeHost();
		host.files.set("S/T/Renamed.md", topicFm());
		host.files.set("S/T/messages/a.md", msgFm("msg-a", { topic: "[Renamed](../Renamed.md)" }));
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topic("S/T")?.issues.map((i) => i.kind)).toEqual(["topic-note-renamed"]);
	});

	it("flags a second Folder Note in the same folder", async () => {
		const host = vault();
		host.files.set(`${TOPIC}/Other.md`, topicFm("topic-zzzzzzzzzzzz"));
		const index = new TopicIndex(host);
		await index.build();
		expect(index.topics()).toHaveLength(1);
		expect(index.topic(TOPIC)?.issues.map((i) => i.kind)).toEqual(["duplicate-topic-note"]);
	});

	it("flags duplicate topic ids and duplicate message ids across topics", async () => {
		const host = vault();
		host.files.set("Spaces/A/Two/Two.md", topicFm("topic-aaaaaaaaaaaa"));
		host.files.set("Spaces/A/Two/messages/x.md", msgFm("msg-a", { topic: "[T](../Two.md)" }));
		const index = new TopicIndex(host);
		await index.build();
		const issues = index
			.vaultIssues()
			.map((i) => `${i.kind}:${i.path}`)
			.sort();
		expect(issues).toEqual(
			[
				`duplicate-id:${NOTE}`,
				"duplicate-id:Spaces/A/Two/Two.md",
				`duplicate-id:${m("a")}`,
				"duplicate-id:Spaces/A/Two/messages/x.md",
			].sort(),
		);
	});
});

describe("TopicIndex.update", () => {
	it("re-reads only the affected topic and reports it", async () => {
		const host = vault();
		host.files.set("S/Other/Other.md", topicFm("topic-oooooooooooo"));
		const index = new TopicIndex(host);
		await index.build();
		const other = index.topic("S/Other");

		host.files.set(m("c"), msgFm("msg-c", { created: "2026-10-01T12:00:00" }));
		const changed = await index.update([m("c")]);

		expect([...changed]).toEqual([TOPIC]);
		expect(index.topic(TOPIC)?.thread.nodes.has(m("c"))).toBe(true);
		expect(index.topic("S/Other")).toBe(other);
	});

	it("reflects a status change", async () => {
		const host = vault();
		const index = new TopicIndex(host);
		await index.build();
		host.files.set(m("b"), msgFm("msg-b", { parent: "[p](./a.md)", status: "removed" }));
		await index.update([m("b")]);
		expect(index.topic(TOPIC)?.thread.nodes.get(m("b"))?.hiddenReason).toBe("removed");
	});

	it("drops a deleted message and keeps its former child as an orphan, not reattached", async () => {
		const host = vault();
		const index = new TopicIndex(host);
		await index.build();
		host.files.delete(m("a"));
		await index.update([m("a")]);
		const thread = index.topic(TOPIC)?.thread;
		expect(thread?.nodes.has(m("a"))).toBe(false);
		expect(thread?.orphans.map((n) => n.path)).toEqual([m("b")]);
		expect(thread?.issues.map((i) => i.kind)).toEqual(["missing-parent"]);
	});

	it("handles a message renamed within messages/ by reporting the stale link, never guessing", async () => {
		const host = vault();
		const index = new TopicIndex(host);
		await index.build();
		const fm = host.files.get(m("a"));
		host.files.delete(m("a"));
		host.files.set(m("a-renamed"), fm);
		await index.update([m("a"), m("a-renamed")]);
		const thread = index.topic(TOPIC)?.thread;
		expect(thread?.orphans.map((n) => n.path)).toEqual([m("b")]);
		expect(thread?.roots.map((n) => n.path)).toEqual([m("a-renamed")]);
	});

	it("adds a new topic and removes one whose Folder Note is gone", async () => {
		const host = vault();
		const index = new TopicIndex(host);
		await index.build();

		host.files.set("S/New/New.md", topicFm("topic-nnnnnnnnnnnn"));
		expect([...(await index.update(["S/New/New.md"]))]).toEqual(["S/New"]);
		expect(index.topic("S/New")).toBeDefined();

		host.files.delete(NOTE);
		await index.update([NOTE]);
		expect(index.topic(TOPIC)).toBeUndefined();
	});

	it("does not report topics for unrelated files", async () => {
		const index = new TopicIndex(vault());
		await index.build();
		expect([...(await index.update(["Elsewhere/note.md"]))]).toEqual([]);
	});
});

describe("subscriptions", () => {
	it("notifies listeners with the changed topic folders and supports unsubscribe", async () => {
		const host = vault();
		const index = new TopicIndex(host);
		await index.build();
		const seen: string[][] = [];
		const off = index.subscribe((folders) => seen.push([...folders]));
		host.files.set(m("c"), msgFm("msg-c"));
		await index.update([m("c")]);
		off();
		await index.update([m("c")]);
		expect(seen).toEqual([[TOPIC]]);
	});
});
