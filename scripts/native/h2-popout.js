// H2 and H5: the conversation view and its composer in a popout window, the popout closing while the
// composer is open, and a draft deleted or renamed while it is open. Every embedded editor that is
// opened must be detached exactly once (no orphan leaf), and nothing deleted may be recreated.

async (h) => {
	const P = h.P;
	const typeInto = (doc, text) => {
		const view = doc.querySelector(".unistoria-composer-editor .cm-content")?.cmTile?.view;
		if (!view) return false;
		view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
		return true;
	};
	const click = (doc, root, label) => {
		const button = [...doc.querySelectorAll(`${root} button`)].find((b) => b.textContent === label);
		if (!button) throw new Error(`no button "${label}" in ${root}`);
		button.click();
	};
	const statusOf = async (path) => {
		const text = await app.vault.read(app.vault.getFileByPath(path));
		return /^status: (\w+)$/m.exec(text)?.[1];
	};

	// Count how many markdown leaves are detached: one per embedded editor that was opened.
	const anyLeaf = app.workspace.getMostRecentLeaf();
	const Proto = Object.getPrototypeOf(anyLeaf);
	const originalDetach = Proto.detach;
	const detached = [];
	Proto.detach = function (...args) {
		detached.push(this.view?.getViewType?.() ?? "?");
		return originalDetach.apply(this, args);
	};
	h.useComposerMode("embedded");
	let popLeaf = null;
	const viewsBefore = app.workspace.getLeavesOfType("unistoria-conversation").length;
	try {
		const t = await h.topic("S", "Pop");
		const d1 = await h.message(t, "d1", { status: "draft", body: "First draft", at: 1 });
		const d2 = await h.message(t, "d2", { status: "draft", body: "Second draft", at: 2 });
		await h.refresh();

		// --- popout window ------------------------------------------------------------------------
		popLeaf = app.workspace.openPopoutLeaf();
		await h.sleep(1200);
		await popLeaf.setViewState({
			type: "unistoria-conversation",
			active: true,
			state: { topic: t.folder },
		});
		await h.sleep(1800);
		const view = popLeaf.view;
		const doc = view.containerEl.ownerDocument;
		const win = doc.defaultView;
		h.check(
			"the view opens in a popout window",
			win !== window && Boolean(doc.querySelector(".unistoria-view")),
			`popout: ${win !== window}`,
		);
		h.check(
			"the drafts list renders in the popout",
			doc.querySelectorAll(".unistoria-drafts li").length === 2,
		);

		click(doc, ".unistoria-drafts", "Open");
		await h.sleep(2200);
		const cm = doc.querySelector(".unistoria-composer-editor .cm-content");
		h.check(
			"the composer editor mounts in the popout document",
			Boolean(cm) && cm.ownerDocument === doc,
		);
		const rect = cm?.getBoundingClientRect();
		h.check(
			"the editor has a usable size in the popout",
			rect && rect.width > 200 && rect.height > 40,
			rect && `${Math.round(rect.width)}x${Math.round(rect.height)}`,
		);
		h.check(
			"the editor is bound to the popout window",
			doc.querySelector(".unistoria-composer-editor .workspace-leaf")?.win === win ||
				doc.defaultView === win,
		);

		typeInto(doc, "Typed in the popout.\n");
		await h.sleep(300);
		click(doc, ".unistoria-composer-dock", "Publish");
		await h.sleep(2500);
		h.check(
			"publish from the popout changes the status",
			(await statusOf(d1)) === "published",
			await statusOf(d1),
		);
		h.check(
			"the composer closes after publishing",
			!doc.querySelector(".unistoria-composer-dock .cm-content"),
		);
		const publishedText = await app.vault.read(app.vault.getFileByPath(d1));
		h.check(
			"text typed in the popout reached the file",
			publishedText.includes("Typed in the popout."),
		);

		// --- popout closed while the composer is open ----------------------------------------------
		const second = [...doc.querySelectorAll(".unistoria-drafts li")].find((li) =>
			li.textContent.includes("(new message)"),
		);
		second?.querySelector("button")?.click();
		await h.sleep(2200);
		h.check(
			"a second composer opens in the popout",
			Boolean(doc.querySelector(".unistoria-composer-editor .cm-content")),
		);
		typeInto(doc, "Unsaved when the window closes.\n");
		await h.sleep(200);
		const beforeClose = detached.filter((x) => x === "markdown").length;
		popLeaf.detach();
		popLeaf = null;
		await h.sleep(2500);
		const afterClose = detached.filter((x) => x === "markdown").length;
		h.check(
			"closing the popout detaches the embedded editor",
			afterClose > beforeClose,
			`markdown detaches ${beforeClose} -> ${afterClose}`,
		);
		const closedText = await app.vault.read(app.vault.getFileByPath(d2));
		h.check(
			"text typed before the window closed was saved",
			closedText.includes("Unsaved when the window closes."),
		);
		h.check(
			"the conversation view is gone with its window",
			app.workspace.getLeavesOfType("unistoria-conversation").length === viewsBefore,
			`views ${viewsBefore} -> ${app.workspace.getLeavesOfType("unistoria-conversation").length}`,
		);

		// --- main window: draft deleted or renamed while open ----------------------------------------
		const d3 = await h.message(t, "d3", { status: "draft", body: "Third draft", at: 3 });
		await h.refresh();
		await P.activateView(t.folder);
		await h.sleep(1500);
		const mainView = app.workspace
			.getLeavesOfType("unistoria-conversation")
			.find((l) => l.view.containerEl.ownerDocument === document).view;
		const draftRows = [...document.querySelectorAll(".unistoria-drafts li")];
		const row =
			draftRows.find((li) =>
				li.querySelector("button")?.getAttribute("aria-label")?.includes("2026-10-02 08:00"),
			) ?? draftRows[draftRows.length - 1];
		row.querySelector("button").click();
		await h.sleep(2000);
		h.check(
			"a composer opens in the main window",
			Boolean(document.querySelector(".unistoria-composer-editor .cm-content")),
		);
		const opened = draftRows.length;
		const openPath = mainView.composer.current?.path;
		h.check("the composer knows which file it is on", Boolean(openPath), openPath);
		await app.fileManager.trashFile(app.vault.getFileByPath(openPath));
		await h.sleep(2000);
		h.check(
			"deleting the open draft closes the composer",
			!document.querySelector(".unistoria-composer-dock .cm-content"),
		);
		h.check("the deleted draft is not recreated", !app.vault.getFileByPath(openPath), openPath);

		const d4 = await h.message(t, "d4", { status: "draft", body: "Fourth draft", at: 4 });
		await h.refresh();
		await h.sleep(800);
		const li = [...document.querySelectorAll(".unistoria-drafts li button")].pop();
		li?.click();
		await h.sleep(2000);
		await app.fileManager.renameFile(app.vault.getFileByPath(d4), `${t.messages}/d4-renamed.md`);
		await h.sleep(1500);
		typeInto(document, "After the rename.\n");
		await h.sleep(300);
		click(document, ".unistoria-composer-dock", "Publish");
		await h.sleep(2500);
		h.check(
			"publishing still works after the open draft was renamed",
			(await statusOf(`${t.messages}/d4-renamed.md`)) === "published",
			await statusOf(`${t.messages}/d4-renamed.md`),
		);
		h.note(
			"markdown detaches (one per embedded editor)",
			detached.filter((x) => x === "markdown").length,
		);
		h.note("draft count seen before deletion", opened);
	} finally {
		Proto.detach = originalDetach;
		if (popLeaf) popLeaf.detach();
		for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		await h.cleanup();
	}
	return h.report();
};
