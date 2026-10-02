import { describe, expect, it } from "vitest";
import {
	buildLink,
	encodeDestination,
	parseLink,
	relativePath,
	resolveDestination,
} from "../../src/core/links/links";

describe("encodeDestination", () => {
	it("encodes only percent and space", () => {
		expect(encodeDestination("Topic Name.md")).toBe("Topic%20Name.md");
		expect(encodeDestination("Topic 100%.md")).toBe("Topic%20100%25.md");
		expect(encodeDestination("a&b+c,d;e=f@g$h.md")).toBe("a&b+c,d;e=f@g$h.md");
		expect(encodeDestination("Tópik 日本.md")).toBe("Tópik%20日本.md");
	});
});

describe("relativePath", () => {
	it("links a message to its Folder Note one level up", () => {
		expect(relativePath("Topic Name/messages/x.md", "Topic Name/Topic Name.md")).toBe(
			"../Topic Name.md",
		);
	});

	it("uses ./ for a sibling", () => {
		expect(relativePath("T/messages/b.md", "T/messages/a.md")).toBe("./a.md");
	});

	it("walks up and down across folders", () => {
		expect(relativePath("a/b/c.md", "a/d/e.md")).toBe("../d/e.md");
		expect(relativePath("a.md", "b/c.md")).toBe("./b/c.md");
	});
});

describe("buildLink", () => {
	it("builds the example from the specification", () => {
		expect(buildLink("Topic Name", "Topic Name/messages/x.md", "Topic Name/Topic Name.md")).toBe(
			"[Topic Name](../Topic%20Name.md)",
		);
	});

	it("escapes brackets and backslashes in the link text", () => {
		expect(buildLink("a [b] \\ c", "t/m/x.md", "t/m/y.md")).toBe("[a \\[b\\] \\\\ c](./y.md)");
	});
});

describe("parseLink", () => {
	it("parses text and destination", () => {
		expect(parseLink("[Topic Name](../Topic%20Name.md)")).toEqual({
			ok: true,
			text: "Topic Name",
			destination: "../Topic%20Name.md",
		});
	});

	it("accepts surrounding whitespace and angle-bracket destinations", () => {
		expect(parseLink("  [x](<../A b.md>) ")).toEqual({
			ok: true,
			text: "x",
			destination: "../A b.md",
		});
	});

	it("unescapes link text", () => {
		expect(parseLink("[a \\[b\\]](./y.md)")).toEqual({
			ok: true,
			text: "a [b]",
			destination: "./y.md",
		});
	});

	it.each([
		["[[Topic Name]]", "wikilink"],
		["../Topic Name.md", "not-a-link"],
		["", "empty"],
		["[x]()", "empty-destination"],
		["[x](a.md) trailing", "not-a-link"],
	])("rejects %j as %s", (value, reason) => {
		expect(parseLink(value)).toEqual({ ok: false, reason });
	});

	it("rejects non-strings", () => {
		expect(parseLink(undefined)).toEqual({ ok: false, reason: "not-text" });
		expect(parseLink(3)).toEqual({ ok: false, reason: "not-text" });
	});
});

describe("resolveDestination", () => {
	const source = "Topic Name/messages/2026-10-01T104500-def456.md";

	it("resolves the specification example", () => {
		expect(resolveDestination(source, "../Topic%20Name.md")).toEqual({
			ok: true,
			path: "Topic Name/Topic Name.md",
		});
	});

	it("resolves siblings with and without ./", () => {
		expect(resolveDestination(source, "./a.md")).toEqual({
			ok: true,
			path: "Topic Name/messages/a.md",
		});
		expect(resolveDestination(source, "a.md")).toEqual({
			ok: true,
			path: "Topic Name/messages/a.md",
		});
	});

	it("accepts raw and percent-encoded non-ASCII", () => {
		const raw = resolveDestination(source, "../Tópik%20日本.md");
		const encoded = resolveDestination(source, "../T%C3%B3pik%20%E6%97%A5%E6%9C%AC.md");
		expect(raw).toEqual(encoded);
		expect(raw).toEqual({ ok: true, path: "Topic Name/Tópik 日本.md" });
	});

	it("decodes a literal percent written as %25 exactly once", () => {
		expect(resolveDestination(source, "../Topic%20100%25.md")).toEqual({
			ok: true,
			path: "Topic Name/Topic 100%.md",
		});
		expect(resolveDestination(source, "../50%2520x.md")).toEqual({
			ok: true,
			path: "Topic Name/50%20x.md",
		});
	});

	it("falls back to the raw text when decoding fails", () => {
		expect(resolveDestination(source, "../100%.md")).toEqual({
			ok: true,
			path: "Topic Name/100%.md",
		});
	});

	it("keeps reserved characters that Obsidian writes raw", () => {
		expect(resolveDestination(source, "../a&b+c.md")).toEqual({
			ok: true,
			path: "Topic Name/a&b+c.md",
		});
	});

	it("rejects absolute paths, schemes, and fragments", () => {
		expect(resolveDestination(source, "/Topic Name/x.md")).toEqual({
			ok: false,
			reason: "absolute",
		});
		expect(resolveDestination(source, "https://example.com/x.md")).toEqual({
			ok: false,
			reason: "absolute",
		});
		expect(resolveDestination(source, "../x.md#heading")).toEqual({
			ok: false,
			reason: "fragment",
		});
		expect(resolveDestination(source, "../x%23y.md")).toEqual({ ok: false, reason: "fragment" });
	});

	it("rejects a path that leaves the vault", () => {
		expect(resolveDestination("a/b.md", "../../x.md")).toEqual({
			ok: false,
			reason: "outside-vault",
		});
	});

	it("rejects a non-markdown destination", () => {
		expect(resolveDestination(source, "../image.png")).toEqual({
			ok: false,
			reason: "not-markdown",
		});
	});

	it("normalizes dot segments", () => {
		expect(resolveDestination("a/b/c.md", "./../d/./e.md")).toEqual({ ok: true, path: "a/d/e.md" });
	});

	it("round-trips every link the writer produces", () => {
		for (const name of ["Topic Name", "100%", "a&b", "Tópik 日本", "50%20x", "x (y)"]) {
			const from = `${name}/messages/m.md`;
			const to = `${name}/${name}.md`;
			const link = parseLink(buildLink(name, from, to));
			expect(link.ok && resolveDestination(from, link.destination)).toEqual({ ok: true, path: to });
		}
	});
});
