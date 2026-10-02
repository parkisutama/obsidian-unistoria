import { describe, expect, it } from "vitest";
import { countTasks, toggleTask } from "../../src/core/markdown/tasks";

const file = (body: string) => `---\ntype: discussion-message\nstatus: published\n---\n\n${body}`;

describe("countTasks", () => {
	it("counts task list items in the body, in order", () => {
		const text = file("Intro\n\n- [ ] one\n- [x] two\n  - [ ] nested\n1. [ ] numbered\n");
		expect(countTasks(text)).toBe(4);
	});

	it("ignores frontmatter and fenced code", () => {
		const text = `---\nnote: "- [ ] not a task"\n---\n\n\`\`\`md\n- [ ] in code\n\`\`\`\n\n~~~\n- [x] also code\n~~~\n\n- [ ] real\n`;
		expect(countTasks(text)).toBe(1);
	});

	it("counts tasks inside block quotes and callouts", () => {
		expect(countTasks(file("> [!note]\n> - [ ] in a callout\n> - [x] done\n"))).toBe(2);
	});

	it("does not count look-alikes", () => {
		expect(countTasks(file("[ ] no bullet\n- [] empty\n- [ ]no space\n-[ ] glued\n"))).toBe(0);
	});

	it("handles files without frontmatter and Windows line endings", () => {
		expect(countTasks("- [ ] a\r\n- [x] b\r\n")).toBe(2);
	});
});

describe("toggleTask", () => {
	const text = file("- [ ] one\n- [x] two\n- [ ] three\n");

	it("checks an unchecked task and touches nothing else", () => {
		expect(toggleTask(text, 0, false)).toBe(file("- [x] one\n- [x] two\n- [ ] three\n"));
	});

	it("unchecks a checked task", () => {
		expect(toggleTask(text, 1, true)).toBe(file("- [ ] one\n- [ ] two\n- [ ] three\n"));
	});

	it("treats any other marker as not done and checks it", () => {
		expect(toggleTask(file("- [/] half\n"), 0, false)).toBe(file("- [x] half\n"));
	});

	it("uppercase X counts as checked", () => {
		expect(toggleTask(file("- [X] big\n"), 0, true)).toBe(file("- [ ] big\n"));
	});

	it("refuses when the expected state no longer matches, or the index is out of range", () => {
		expect(toggleTask(text, 0, true)).toBeNull();
		expect(toggleTask(text, 3, false)).toBeNull();
		expect(toggleTask(text, -1, false)).toBeNull();
	});

	it("skips tasks in code when indexing", () => {
		const t = file("```\n- [ ] code\n```\n\n- [ ] real\n");
		expect(toggleTask(t, 0, false)).toBe(file("```\n- [ ] code\n```\n\n- [x] real\n"));
	});

	it("keeps quote and indent prefixes and line endings", () => {
		expect(toggleTask("> - [ ] quoted\r\n", 0, false)).toBe("> - [x] quoted\r\n");
		expect(toggleTask("  * [ ] indented\n", 0, false)).toBe("  * [x] indented\n");
	});

	it("never changes the frontmatter", () => {
		const t = `---\nlist:\n  - [ ] x\n---\n\n- [ ] body\n`;
		expect(toggleTask(t, 0, false)).toBe(`---\nlist:\n  - [ ] x\n---\n\n- [x] body\n`);
	});
});
