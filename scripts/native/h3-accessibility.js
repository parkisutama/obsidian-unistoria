// H3: keyboard and screen-reader support, checked from the DOM and from focus behaviour.
// Real key presses cannot be sent from a script, so this verifies what makes them work: native
// focusable controls with names, structure and states, focus kept across re-renders, focus moved
// into the composer and returned to the control that opened it, and live-region announcements.

async (h) => {
	const P = h.P;
	const key = (el) => el?.getAttribute?.("data-focus-key") ?? null;
	h.useComposerMode("embedded");
	try {
		const t = await h.topic("S", "A11y");
		const a = await h.message(t, "a", { at: 1, body: "Root message" });
		await h.message(t, "b", { parent: a, at: 2, body: "A reply" });
		await h.message(t, "c", { parent: a, at: 3, body: "Another reply" });
		await h.refresh();
		await P.activateView(t.folder);
		await h.sleep(1800);

		const root = document.querySelector(".unistoria-view");
		h.check("the view is open", Boolean(root));

		// --- structure and names --------------------------------------------------------------------
		const unnamed = [...root.querySelectorAll("button, a[href], input, select, textarea")].filter(
			(el) => {
				const name = (
					el.getAttribute("aria-label") ||
					el.textContent ||
					el.labels?.[0]?.textContent ||
					""
				).trim();
				return name === "" && !el.closest(".unistoria-composer-dock") && el.offsetParent !== null;
			},
		);
		h.check(
			"every control has an accessible name",
			unnamed.length === 0,
			unnamed.map((e) => e.outerHTML.slice(0, 80)).join(" | "),
		);
		h.check(
			"no control is removed from the tab order",
			[...root.querySelectorAll("button, a[href], input")].every((el) => el.tabIndex >= 0),
		);
		h.check(
			"the topic list is a labelled navigation landmark",
			root.querySelector("nav.unistoria-nav")?.getAttribute("aria-label") === "Topics",
		);
		h.check(
			"the conversation is a list of articles",
			Boolean(root.querySelector("ul.unistoria-thread > li > article")),
		);
		h.check(
			"replies are a nested list",
			Boolean(root.querySelector("li > ul.unistoria-children > li > article")),
		);
		const articles = [...root.querySelectorAll("article.unistoria-message")];
		h.check(
			"every message has an accessible label",
			articles.every((el) => /^Message from /.test(el.getAttribute("aria-label") || "")),
			articles.length,
		);
		h.check(
			"the current topic is marked",
			root.querySelector(".unistoria-topic-item[aria-current='true']") !== null,
		);
		h.check(
			"a live region exists",
			root.querySelector(".unistoria-live")?.getAttribute("aria-live") === "polite",
		);

		// --- thread collapse ------------------------------------------------------------------------
		const toggle = root.querySelector(".unistoria-thread-toggle");
		h.check(
			"the thread toggle exposes its state",
			toggle?.getAttribute("aria-expanded") === "true" &&
				Boolean(toggle?.getAttribute("aria-controls")),
			toggle?.outerHTML.slice(0, 160),
		);
		h.check(
			"the toggle points at the replies list",
			Boolean(root.querySelector(`#${CSS.escape(toggle.getAttribute("aria-controls"))}`)),
		);
		toggle.focus();
		toggle.click();
		await h.sleep(900);
		const afterToggle = document.activeElement;
		h.check(
			"focus stays on the thread toggle after it re-renders",
			key(afterToggle)?.startsWith("thread:"),
			key(afterToggle),
		);
		h.check(
			"the collapsed state is exposed",
			afterToggle?.getAttribute("aria-expanded") === "false",
		);
		h.check(
			"collapsing is announced",
			/hidden/.test(root.querySelector(".unistoria-live").textContent),
			root.querySelector(".unistoria-live").textContent,
		);
		afterToggle.click();
		await h.sleep(900);

		// --- focus survives a re-render caused by the vault -----------------------------------------
		const reply = root.querySelector("button[data-focus-key^='reply:']");
		reply.focus();
		const wanted = key(reply);
		await app.vault.process(
			app.vault.getFileByPath(`${t.messages}/b.md`),
			(text) => `${text}\nedited elsewhere\n`,
		);
		await h.sleep(1500);
		h.check(
			"focus survives a re-render caused by another change",
			key(document.activeElement) === wanted,
			`${wanted} -> ${key(document.activeElement)}`,
		);

		// --- composer focus -------------------------------------------------------------------------
		const replyButton = root.querySelector("button[data-focus-key^='reply:']");
		replyButton.focus();
		const openerKey = key(replyButton);
		replyButton.click();
		await h.sleep(2500);
		const dock = root.querySelector(".unistoria-composer-dock");
		h.check(
			"the composer is a labelled region",
			dock?.getAttribute("role") === "region" &&
				/^Composer:/.test(dock.getAttribute("aria-label") || ""),
			dock?.getAttribute("aria-label"),
		);
		h.check(
			"focus moves into the editor when the composer opens",
			Boolean(dock?.querySelector(".cm-editor.cm-focused, .cm-editor:focus-within")) ||
				dock?.contains(document.activeElement),
			document.activeElement?.className,
		);
		h.check(
			"opening the composer is announced",
			/Composer opened/.test(root.querySelector(".unistoria-live").textContent),
			root.querySelector(".unistoria-live").textContent,
		);
		[...dock.querySelectorAll("button")].find((b) => b.textContent === "Close").click();
		await h.sleep(1800);
		h.check(
			"focus returns to the control that opened the composer",
			key(document.activeElement) === openerKey,
			`${openerKey} -> ${key(document.activeElement)}`,
		);
	} finally {
		for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		await h.cleanup();
	}
	return h.report();
};
