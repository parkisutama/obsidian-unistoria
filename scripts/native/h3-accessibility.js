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
		const c = await h.message(t, "c", { parent: a, at: 3, body: "Another reply" });
		// A reply to a reply, as an older or hand-written file may hold (ADR-008).
		await h.message(t, "d", { parent: c, at: 4, body: "A reply to a reply" });
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
			"the topic page lists only the message that starts the thread",
			root.querySelectorAll(".unistoria-scroll article.unistoria-message").length === 1,
			root.querySelectorAll(".unistoria-scroll article.unistoria-message").length,
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

		// --- topic list --------------------------------------------------------------------------------
		const visible = (el) => Boolean(el) && el.offsetParent !== null && el.offsetWidth > 0;
		const nav = root.querySelector("nav.unistoria-nav");
		const listToggle = () => nav.querySelector("button[data-focus-key='list-toggle']");
		h.check(
			"the topic list holds its own show and hide button",
			visible(listToggle()) && listToggle().getAttribute("aria-expanded") === "true",
		);
		const navWidth = nav.offsetWidth;
		listToggle().focus();
		listToggle().click();
		await h.sleep(300);
		h.check(
			"hidden, the topic list is a narrow rail that still shows the button",
			visible(listToggle()) &&
				listToggle().getAttribute("aria-expanded") === "false" &&
				nav.offsetWidth < 80 &&
				nav.querySelector(".unistoria-topic-item") === null,
			`${navWidth} -> ${nav.offsetWidth}`,
		);
		h.check("focus stays on the button", document.activeElement === listToggle());
		h.check(
			"the main pane keeps its width beside the rail",
			root.querySelector(".unistoria-scroll").offsetWidth > 200,
			root.querySelector(".unistoria-scroll").offsetWidth,
		);
		listToggle().click();
		await h.sleep(300);
		h.check(
			"the topic list comes back",
			nav.offsetWidth === navWidth && nav.querySelector(".unistoria-topic-item") !== null,
			nav.offsetWidth,
		);
		const title = root.querySelector(".unistoria-topic-header h2").getBoundingClientRect();
		const tools = root.querySelector(".unistoria-topic-tools").getBoundingClientRect();
		h.check("the topic title has its own line above the controls", tools.top >= title.bottom);

		// --- thread panel ------------------------------------------------------------------------------
		const panel = root.querySelector("aside.unistoria-thread-panel");
		const toggle = root.querySelector(".unistoria-thread-open");
		h.check(
			"the thread control states the replies and its state",
			/^3 replies/.test(toggle?.textContent ?? "") &&
				toggle?.getAttribute("aria-expanded") === "false" &&
				toggle?.getAttribute("aria-controls") === panel?.id,
			toggle?.outerHTML.slice(0, 200),
		);
		h.check("the thread panel is closed at first", !visible(panel));
		toggle.focus();
		toggle.click();
		await h.sleep(900);
		const afterToggle = document.activeElement;
		h.check(
			"focus stays on the thread control after it re-renders",
			key(afterToggle)?.startsWith("thread:"),
			key(afterToggle),
		);
		h.check("the open state is exposed", afterToggle?.getAttribute("aria-expanded") === "true");
		h.check(
			"the thread panel is shown beside the topic page",
			visible(panel) &&
				panel.offsetWidth > 200 &&
				visible(root.querySelector(".unistoria-scroll")) &&
				panel.getBoundingClientRect().left >=
					root.querySelector(".unistoria-scroll").getBoundingClientRect().right - 1,
			`${panel.offsetWidth}px`,
		);
		h.check(
			"opening is announced",
			/Thread opened/.test(root.querySelector(".unistoria-live").textContent),
			root.querySelector(".unistoria-live").textContent,
		);
		const replies = [...panel.querySelectorAll("ul.unistoria-replies > li > article")];
		h.check(
			"replies are one flat list in the panel, deeper ones included, in time order",
			replies.length === 3 &&
				replies.map((el) => el.getAttribute("data-path").split("/").pop()).join() ===
					"b.md,c.md,d.md",
			replies.map((el) => el.getAttribute("data-path").split("/").pop()).join(),
		);
		const quote = replies[2]?.querySelector("button.unistoria-quote");
		h.check(
			"a reply to a reply quotes the message it answers; a direct reply has no quote",
			quote?.querySelector(".unistoria-quote-text")?.textContent === "Another reply" &&
				/^In reply to the message from /.test(quote?.getAttribute("aria-label") ?? "") &&
				replies[0]?.querySelector(".unistoria-quote") === null,
			quote?.outerHTML.slice(0, 200),
		);
		quote.click();
		await h.sleep(200);
		h.check(
			"selecting the quote moves to the quoted message",
			document.activeElement === replies[1] && replies[1].classList.contains("is-flash"),
			document.activeElement?.getAttribute("data-path"),
		);
		h.check(
			"a reply cannot start a thread",
			panel.querySelectorAll("ul.unistoria-replies .unistoria-thread-open").length === 0,
		);
		h.check(
			"every reply can be answered",
			replies.every((el) => el.querySelector("button[data-focus-key^='panel:reply:']")),
		);
		h.check(
			"the panel has one reply button for the thread",
			panel.querySelectorAll("button[data-focus-key='panel:reply']").length === 1,
		);
		const keys = [...root.querySelectorAll("[data-focus-key]")].map(key);
		h.check(
			"focus keys stay unique while a message is shown twice",
			new Set(keys).size === keys.length,
			keys.filter((k, i) => keys.indexOf(k) !== i).join(),
		);

		const full = () => root.querySelector("button[data-focus-key='thread-full']");
		full().focus();
		full().click();
		await h.sleep(900);
		h.check(
			"expanded, the thread takes the whole view",
			!visible(root.querySelector(".unistoria-scroll")) &&
				!visible(nav) &&
				panel.offsetWidth >= root.offsetWidth - 2,
			`${panel.offsetWidth}/${root.offsetWidth}`,
		);
		h.check(
			"the expanded thread names its topic",
			panel.querySelector(".unistoria-thread-crumb")?.textContent === "A11y",
		);
		h.check(
			"focus stays on the expand button and its state is exposed",
			document.activeElement === full() && full().getAttribute("aria-pressed") === "true",
			key(document.activeElement),
		);
		full().click();
		await h.sleep(900);
		h.check(
			"the thread returns beside the topic page",
			visible(root.querySelector(".unistoria-scroll")) && visible(nav),
		);
		root.querySelector("button[data-focus-key='thread-close']").click();
		await h.sleep(900);
		h.check("closing hides the panel", !visible(panel));
		h.check(
			"focus returns to the thread control of the message",
			key(document.activeElement)?.startsWith("thread:") &&
				document.activeElement.getAttribute("aria-expanded") === "false",
			key(document.activeElement),
		);
		h.check(
			"closing is announced",
			/Thread closed/.test(root.querySelector(".unistoria-live").textContent),
			root.querySelector(".unistoria-live").textContent,
		);

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
		h.check(
			"replying opens the thread the reply belongs to",
			visible(root.querySelector("aside.unistoria-thread-panel")),
		);
		const drafts = [...h.P.index.topic(t.folder).thread.drafts];
		h.check(
			"the new reply points to the message that starts the thread",
			drafts.length === 1 && drafts[0].parentPath === a,
			drafts.map((n) => n.parentPath).join(),
		);

		// --- answering a reply ----------------------------------------------------------------------
		const replyToC = [
			...root.querySelectorAll("aside.unistoria-thread-panel button[data-focus-key^='panel:reply:']"),
		].find((b) => key(b).endsWith("/c.md"));
		replyToC.focus();
		replyToC.click();
		await h.sleep(2500);
		const dock2 = root.querySelector(".unistoria-composer-dock");
		h.check(
			"answering a reply opens a composer named after that reply",
			/^Composer: Reply to the message from /.test(dock2?.getAttribute("aria-label") || ""),
			dock2?.getAttribute("aria-label"),
		);
		const parents = [...h.P.index.topic(t.folder).thread.drafts].map((n) => n.parentPath).sort();
		h.check(
			"the answer points to the reply it answers, in the same topic",
			parents.length === 2 && parents.includes(c) && parents.includes(a),
			parents.join(),
		);
		[...dock2.querySelectorAll("button")].find((b) => b.textContent === "Close").click();
		await h.sleep(1800);
		h.check(
			"focus returns to the reply button in the panel",
			key(document.activeElement) === `panel:reply:${c}`,
			key(document.activeElement),
		);
	} finally {
		for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		await h.cleanup();
	}
	return h.report();
};
