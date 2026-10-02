// Rendered Markdown in the conversation: Obsidian's own renderer for callouts, quotes, code, and
// embeds; internal links that open, Page Preview on hover, tags that search, and task checkboxes
// that change the file. Also the centered reading column.

async (h) => {
	const P = h.P;
	h.useComposerMode("split");
	const sleep = h.sleep;
	let restore = [];
	try {
		const t = await h.topic("S", "Md");
		await app.vault.process(app.vault.getFileByPath(t.notePath), (text) => `${text}\n- [ ] context task\n`);
		await app.vault.create(`${h.ROOT}/Linked note.md`, "A note to link to.\n");
		await app.vault.create(`${h.ROOT}/Embedded.md`, "- [ ] embedded task\n");
		const body = [
			"Intro with [[Linked note]], a tag #tag1 and an [external link](https://example.com).",
			"",
			"> [!note] Heads up",
			"> callout body",
			"",
			"> a plain quote",
			"",
			"- [ ] task one",
			"- [x] task two",
			"",
			"```md",
			"- [ ] not a task, it is code",
			"```",
		].join("\n");
		const m1 = await h.message(t, "m1", { body, at: 1 });
		const m2 = await h.message(t, "m2", { body: "- [ ] own task\n\n![[Embedded]]", at: 2 });
		await h.refresh();
		await P.activateView(t.folder);
		await h.sleep(2500);

		const card = (path) => document.querySelector(`article[data-path="${path}"] .unistoria-message-body`);
		const b1 = card(m1);
		const readFile = async (path) => app.vault.read(app.vault.getFileByPath(path));

		// --- rendering ------------------------------------------------------------------------------------
		h.check("the message content carries the reading-view classes", Boolean(b1.querySelector(".unistoria-message-content.markdown-rendered")));
		h.check("a callout renders", Boolean(b1.querySelector(".callout[data-callout='note'] .callout-title-inner")));
		h.check("a block quote renders", Boolean(b1.querySelector("blockquote")));
		h.check("code renders with highlighting", Boolean(b1.querySelector("pre code")));
		h.check("the topic context is rendered the same way", Boolean(document.querySelector(".unistoria-topic-context .unistoria-message-content.markdown-rendered")));

		const column = document.querySelector(".unistoria-column").getBoundingClientRect();
		const scroll = document.querySelector(".unistoria-scroll").getBoundingClientRect();
		const left = column.left - scroll.left;
		const right = scroll.right - column.right;
		h.check("the conversation is a centered column", Math.abs(left - right) <= 20, `left ${Math.round(left)}, right ${Math.round(right)}`);
		h.note("column width", Math.round(column.width));

		// --- internal links ---------------------------------------------------------------------------------
		const opened = [];
		const originalOpen = app.workspace.openLinkText;
		app.workspace.openLinkText = (...args) => { opened.push(args); return Promise.resolve(); };
		restore.push(() => { app.workspace.openLinkText = originalOpen; });
		const link = b1.querySelector("a.internal-link");
		link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		await sleep(200);
		h.check("clicking an internal link opens it relative to the message", opened.length === 1 && opened[0][0] === "Linked note" && opened[0][1] === m1, JSON.stringify(opened[0]?.slice(0, 2)));

		// --- Page Preview ---------------------------------------------------------------------------------
		const triggered = [];
		const originalTrigger = app.workspace.trigger;
		app.workspace.trigger = function (name, ...rest) { if (name === "hover-link") triggered.push(rest[0]); return originalTrigger.call(this, name, ...rest); };
		restore.push(() => { app.workspace.trigger = originalTrigger; });
		link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
		await sleep(200);
		h.check("hovering an internal link asks Page Preview for a preview", triggered.length === 1 && triggered[0].source === "unistoria" && triggered[0].linktext === "Linked note" && triggered[0].sourcePath === m1, JSON.stringify(triggered[0] && { s: triggered[0].source, l: triggered[0].linktext }));
		h.check("the view is a hover parent", "hoverPopover" in (triggered[0]?.hoverParent ?? {}));
		h.check("Unistoria is registered as a hover link source", Boolean(app.workspace.hoverLinkSources?.unistoria), JSON.stringify(Object.keys(app.workspace.hoverLinkSources ?? {})));

		// The popover itself needs a real mouse: Obsidian's own preview source does not open one for a
		// synthetic event either. Hold Ctrl and hover a link by hand to see it (docs/native-acceptance.md).

		// --- tags -----------------------------------------------------------------------------------------
		const search = app.internalPlugins.getPluginById("global-search")?.instance;
		const queries = [];
		const originalSearch = search?.openGlobalSearch;
		if (search) {
			search.openGlobalSearch = (query) => { queries.push(query); };
			restore.push(() => { search.openGlobalSearch = originalSearch; });
		}
		b1.querySelector("a.tag").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		await sleep(200);
		h.check("clicking a tag searches for it", queries.length === 1 && queries[0] === "tag:#tag1", JSON.stringify(queries));

		// --- task checkboxes --------------------------------------------------------------------------------
		const boxes = [...b1.querySelectorAll("input.task-list-item-checkbox")];
		h.check("the message's own checkboxes are interactive, the code sample is not a checkbox", boxes.length === 2 && boxes.every((b) => !b.disabled), boxes.length);
		boxes[0].click();
		await sleep(1500);
		let text = await readFile(m1);
		h.check("checking a box changes only that line in the file", text.includes("- [x] task one") && text.includes("- [x] task two") && text.includes("- [ ] not a task, it is code"), text.split("\n").filter((l) => /\[.\]/.test(l)).join(" | "));
		h.check("the frontmatter is untouched", /^---\ntype: discussion-message\n/.test(text) && text.includes("status: published"));

		const ctx = document.querySelector(".unistoria-topic-context input.task-list-item-checkbox");
		ctx.click();
		await sleep(1500);
		h.check("a checkbox in the topic context changes the Folder Note", (await readFile(t.notePath)).includes("- [x] context task"));

		// A stale view: the file changes behind the view's back, then the old checkbox is clicked.
		await sleep(600);
		const fresh = card(m1).querySelectorAll("input.task-list-item-checkbox");
		await app.vault.process(app.vault.getFileByPath(m1), (s) => s.replace("- [x] task two", "- [ ] task two"));
		const before = await readFile(m1);
		fresh[1].click();
		await sleep(1200);
		const after = await readFile(m1);
		h.check("a stale click does not change the file", before === after || after.includes("- [ ] task two"), after.split("\n").filter((l) => /task two/.test(l)).join(""));

		// --- checkboxes that cannot be mapped to the source stay read-only ----------------------------------
		await sleep(1200);
		const b2 = card(m2);
		const mixed = [...b2.querySelectorAll("input.task-list-item-checkbox")];
		h.check("an embedded note's checkbox makes all checkboxes in that message read-only", mixed.length === 2 && mixed.every((b) => b.disabled), `${mixed.length} boxes, disabled: ${mixed.map((b) => b.disabled)}`);
	} finally {
		for (const undo of restore) undo();
		for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		await h.cleanup();
	}
	return h.report();
};
