import { describe, expect, it } from "vitest";
import { planMessage } from "../../src/core/creation/message";
import { parseLink, resolveDestination } from "../../src/core/links/links";
import { parseMessageProps } from "../../src/core/schema/schema";

const NOW = new Date(2026, 9, 2, 6, 15, 30);
const base = {
	topicFolder: "Spaces/A/Topic Name",
	notePath: "Spaces/A/Topic Name/Topic Name.md",
	now: NOW,
	messageId: "msg-123456abcdef",
};

describe("planMessage", () => {
	it("creates a draft reply whose parent and topic links resolve to the right files", () => {
		const parentPath = "Spaces/A/Topic Name/messages/2026-10-01T103000-abc123.md";
		const plan = planMessage({ ...base, parentPath });
		expect(plan.path).toBe("Spaces/A/Topic Name/messages/2026-10-02T061530-123456.md");
		expect(plan.messageId).toBe("msg-123456abcdef");

		const text = plan.content;
		expect(text).toContain('topic: "[Topic Name](../Topic%20Name.md)"');
		expect(text).toContain('parent: "[Parent message](./2026-10-01T103000-abc123.md)"');
		expect(text).toContain("status: draft");
		expect(text).toContain("created: 2026-10-02T06:15:30");

		const fm = Object.fromEntries(
			text
				.split("---")[1]
				?.split("\n")
				.filter(Boolean)
				.map((l) => [
					l.slice(0, l.indexOf(":")),
					l.slice(l.indexOf(":") + 2).replace(/^"|"$/g, ""),
				]) ?? [],
		);
		const parsed = parseMessageProps(fm);
		expect(parsed.ok).toBe(true);
		const parent = parseLink(fm.parent);
		expect(parent.ok && resolveDestination(plan.path, parent.destination)).toEqual({
			ok: true,
			path: parentPath,
		});
		const topic = parseLink(fm.topic);
		expect(topic.ok && resolveDestination(plan.path, topic.destination)).toEqual({
			ok: true,
			path: base.notePath,
		});
	});

	it("creates a root draft with an empty parent", () => {
		const plan = planMessage({ ...base, parentPath: null });
		expect(plan.content).toContain('parent: ""');
	});

	it("writes the configured author", () => {
		expect(planMessage({ ...base, parentPath: null, author: "Parkis" }).content).toContain(
			'author: "Parkis"',
		);
		expect(planMessage({ ...base, parentPath: null }).content).toContain('author: ""');
	});

	it("handles a topic note and parent with special characters", () => {
		const plan = planMessage({
			topicFolder: "S/100% & Tópik",
			notePath: "S/100% & Tópik/100% & Tópik.md",
			parentPath: "S/100% & Tópik/messages/p q.md",
			now: NOW,
		});
		expect(plan.content).toContain('topic: "[100% & Tópik](../100%25%20&%20Tópik.md)"');
		expect(plan.content).toContain('parent: "[Parent message](./p%20q.md)"');
		expect(plan.messageId).toMatch(/^msg-[0-9a-f]{12}$/);
	});

	it("generates distinct ids and paths for two drafts in the same second", () => {
		const a = planMessage({ ...base, messageId: undefined, parentPath: null });
		const b = planMessage({ ...base, messageId: undefined, parentPath: null });
		expect(a.messageId).not.toBe(b.messageId);
		expect(a.path).not.toBe(b.path);
	});
});
