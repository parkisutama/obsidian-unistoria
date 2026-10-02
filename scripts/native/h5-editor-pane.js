// ADR-007: writing in an ordinary editor pane split off the conversation (the default composer
// mode). What matters is that this is a real workspace leaf: the active editor exists, editor
// commands work on it, and nothing is left behind in the layout when the composer closes.

async (h) => {
	const P = h.P;
	h.useComposerMode("split");
	const markdownLeaves = () => app.workspace.getLeavesOfType("markdown");
	const leafFor = (path) => markdownLeaves().find((l) => l.view.file?.path === path);
	const statusOf = async (path) => /^status: (\w+)$/m.exec(await app.vault.read(app.vault.getFileByPath(path)))?.[1];
	const clickIn = (doc, scope, label) => {
		const b = [...doc.querySelectorAll(`${scope} button`)].find((x) => x.textContent === label);
		if (!b) throw new Error(`no button "${label}" in ${scope}`);
		b.click();
	};
	const editorOf = (leaf) => leaf?.view.editor;
	let popLeaf = null;

	try {
		const t = await h.topic("S", "Pane");
		const d1 = await h.message(t, "d1", { status: "draft", body: "First draft", at: 1 });
		const d2 = await h.message(t, "d2", { status: "draft", body: "Second draft", at: 2 });
		await h.refresh();
		await P.activateView(t.folder);
		await h.sleep(1800);
		const baseline = markdownLeaves().length;

		// --- open a draft ------------------------------------------------------------------------------
		clickIn(document, ".unistoria-drafts", "Open");
		await h.sleep(2500);
		const dock = document.querySelector(".unistoria-composer-dock");
		h.check("a normal editor pane is added to the layout", markdownLeaves().length === baseline + 1, `${baseline} -> ${markdownLeaves().length}`);
		h.check("the conversation stays on screen", Boolean(document.querySelector(".unistoria-view")?.offsetParent));
		h.check("the dock offers Publish, Close, and Go to editor", ["Publish", "Close", "Go to editor"].every((l) => [...dock.querySelectorAll("button")].some((b) => b.textContent === l)));
		h.check("the dock holds no editor of its own", !dock.querySelector(".cm-content"));

		const firstPath = [d1, d2].find((p) => leafFor(p));
		const leaf = leafFor(firstPath);
		h.check("the editor pane shows the draft", Boolean(leaf), firstPath);
		h.check("the pane is a real leaf with an active editor", app.workspace.activeEditor?.file?.path === firstPath && Boolean(app.workspace.activeEditor?.editor), app.workspace.activeEditor?.file?.path);

		// An editor command, which needs the active editor, works on it.
		const ed = editorOf(leaf);
		const lines = ed.getValue().split("\n");
		const bodyLine = lines.findIndex((l) => /^(First|Second) draft$/.test(l));
		ed.setSelection({ line: bodyLine, ch: 0 }, { line: bodyLine, ch: lines[bodyLine].length });
		app.workspace.setActiveLeaf(leaf, { focus: true });
		await h.sleep(300);
		app.commands.executeCommandById("editor:toggle-bold");
		await h.sleep(300);
		h.check("an editor command (toggle bold) works in the pane", /\*\*\w+ draft\*\*/.test(ed.getValue()), ed.getValue().split("\n")[bodyLine]);

		// --- publish -------------------------------------------------------------------------------------
		ed.setValue(`${ed.getValue()}\nTyped in the pane.\n`);
		await h.sleep(300);
		clickIn(document, ".unistoria-composer-dock", "Publish");
		await h.sleep(2800);
		h.check("publishing from the dock changes the status", (await statusOf(firstPath)) === "published", await statusOf(firstPath));
		h.check("text typed in the pane reached the file", (await app.vault.read(app.vault.getFileByPath(firstPath))).includes("Typed in the pane."));
		h.check("the pane is removed after publishing", markdownLeaves().length === baseline, `${markdownLeaves().length} leaves`);
		h.check("the dock is closed after publishing", !document.querySelector(".unistoria-composer-dock")?.offsetParent);

		// --- close without publishing -----------------------------------------------------------------------
		const remaining = [d1, d2].find((p) => p !== firstPath);
		clickIn(document, ".unistoria-drafts", "Open");
		await h.sleep(2500);
		const second = leafFor(remaining);
		editorOf(second).setValue(`${editorOf(second).getValue()}\nUnpublished edit.\n`);
		await h.sleep(300);
		clickIn(document, ".unistoria-composer-dock", "Close");
		await h.sleep(2200);
		h.check("closing keeps the draft unpublished", (await statusOf(remaining)) === "draft");
		h.check("text typed before closing was saved", (await app.vault.read(app.vault.getFileByPath(remaining))).includes("Unpublished edit."));
		h.check("the pane is removed after closing", markdownLeaves().length === baseline);

		// --- the user closes the pane by hand ---------------------------------------------------------------
		clickIn(document, ".unistoria-drafts", "Open");
		await h.sleep(2500);
		leafFor(remaining).detach();
		await h.sleep(1500);
		h.check("closing the pane by hand closes the dock", !document.querySelector(".unistoria-composer-dock")?.offsetParent);
		h.check("the draft file is untouched by that", (await statusOf(remaining)) === "draft");

		// --- the same in a popout window ---------------------------------------------------------------------
		popLeaf = app.workspace.openPopoutLeaf();
		await h.sleep(1200);
		await popLeaf.setViewState({ type: "unistoria-conversation", active: true, state: { topic: t.folder } });
		await h.sleep(1800);
		const doc = popLeaf.view.containerEl.ownerDocument;
		const win = doc.defaultView;
		clickIn(doc, ".unistoria-drafts", "Open");
		await h.sleep(2500);
		const popEditor = leafFor(remaining);
		h.check("in a popout the editor pane opens in the popout window", Boolean(popEditor) && popEditor.getContainer().win === win, popEditor && String(popEditor.getContainer().win === win));
		popLeaf.detach();
		popLeaf = null;
		await h.sleep(2500);
		h.check("closing the popout leaves no editor pane behind", markdownLeaves().length === baseline, `${markdownLeaves().length} vs ${baseline}`);
	} finally {
		if (popLeaf) popLeaf.detach();
		for (const l of app.workspace.getLeavesOfType("unistoria-conversation")) l.detach();
		await h.cleanup();
	}
	return h.report();
};
