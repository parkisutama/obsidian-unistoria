import { describe, expect, it } from "vitest";
import { quoteExcerpt } from "../../src/core/markdown/quote";

describe("quoteExcerpt", () => {
	it("returns short plain text as written", () => {
		expect(quoteExcerpt("Setuju, lanjutkan.")).toBe("Setuju, lanjutkan.");
	});

	it("joins lines and skips blank ones", () => {
		expect(quoteExcerpt("First line\n\nSecond line\n")).toBe("First line Second line");
	});

	it("drops block markers: headings, quotes, callouts, lists, and task boxes", () => {
		expect(quoteExcerpt("## Langkah kerja\n> [!info] Catatan\n> isi\n- [ ] satu\n2. dua")).toBe(
			"Langkah kerja Catatan isi satu dua",
		);
	});

	it("keeps the text of links, embeds, and wikilinks, and drops emphasis marks", () => {
		expect(
			quoteExcerpt(
				"See [the plan](./plan.md), ![chart](c.png), [[Note|alias]], [[Other]] and **bold** `code`",
			),
		).toBe("See the plan, chart, alias, Other and bold code");
	});

	it("skips code fence lines but keeps the code", () => {
		expect(quoteExcerpt("```js\nlet a = 1;\n```\nafter")).toBe("let a = 1; after");
	});

	it("cuts long text at the limit with an ellipsis", () => {
		const result = quoteExcerpt("word ".repeat(100), 40);
		expect(result.length).toBeLessThanOrEqual(40);
		expect(result.endsWith("…")).toBe(true);
	});

	it("returns an empty string for an empty body", () => {
		expect(quoteExcerpt("  \n\n")).toBe("");
	});
});
