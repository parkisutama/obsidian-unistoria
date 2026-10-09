// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Long messages are shown as an excerpt with a "Read more" button. Short ones are shown in full.
// The choice to expand survives re-renders, keyboard focus stays on the button, and the Folder
// Note's context is shortened the same way.

async (h) => {
	const P = h.P;
	h.useComposerMode("split");
	const LIMIT = 320;
	try {
		const t = await h.topic("S", "Long");
		const longBody = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1} with enough words to take a line of its own in the card.`).join("\n\n");
		await app.vault.process(app.vault.getFileByPath(t.notePath), (text) => `${text}\n${longBody}\n`);
		const long = await h.message(t, "long", { body: longBody, at: 1 });
		const short = await h.message(t, "short", { body: "Just a short reply.", at: 2 });
		const borderline = await h.message(t, "edge", { body: Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`).join("\n\n"), at: 3 });
		await h.refresh();
		await P.activateView(t.folder);
		for (let i = 0; i < 40 && !document.querySelector(`article[data-path="${long}"] .unistoria-read-more`); i++) await h.sleep(250);
		await h.sleep(500);

		const card = (path) => document.querySelector(`article[data-path="${path}"]`);
		const body = (path) => card(path).querySelector(".unistoria-message-body");
		const button = (path) => card(path).querySelector(".unistoria-read-more");
		const visible = (el) => Boolean(el && el.offsetParent !== null);

		// --- a long message -------------------------------------------------------------------------------
		h.check("a long message is clamped", body(long).classList.contains("is-clamped"));
		h.check("a long message is cut at the excerpt height", body(long).getBoundingClientRect().height <= LIMIT + 2, Math.round(body(long).getBoundingClientRect().height));
		h.check("the Read more button shows", visible(button(long)) && button(long).textContent === "Read more", button(long)?.textContent);
		h.check("the button exposes its state and target", button(long).getAttribute("aria-expanded") === "false" && button(long).getAttribute("aria-controls") === body(long).id);
		h.check("the button has a descriptive name", /^Read more of message from/.test(button(long).getAttribute("aria-label") || ""), button(long).getAttribute("aria-label"));
		h.check("the full text is still in the page for assistive technology", body(long).textContent.includes("Paragraph 40"));

		// --- short and borderline messages ------------------------------------------------------------------
		h.check("a short message has no button and no clamp", !visible(button(short)) && !body(short).classList.contains("is-clamped"));
		h.check("a message only a little over the limit is shown in full", !visible(button(borderline)) && !body(borderline).classList.contains("is-clamped"), Math.round(body(borderline).scrollHeight));

		// --- expanding ----------------------------------------------------------------------------------------
		button(long).focus();
		button(long).click();
		await h.sleep(500);
		h.check("Read more expands the message", !body(long).classList.contains("is-clamped") && body(long).getBoundingClientRect().height > LIMIT + 100, Math.round(body(long).getBoundingClientRect().height));
		h.check("the button now says Show less", button(long).textContent === "Show less" && button(long).getAttribute("aria-expanded") === "true");
		h.check("expanding is announced", /expanded/.test(document.querySelector(".unistoria-live").textContent), document.querySelector(".unistoria-live").textContent);

		// --- survives a re-render ---------------------------------------------------------------------------------
		await app.vault.process(app.vault.getFileByPath(short), (text) => `${text}\nEdited.\n`);
		await h.sleep(1800);
		h.check("the expanded state survives a re-render", !body(long).classList.contains("is-clamped") && button(long).textContent === "Show less");
		h.check("focus stays on the button across the re-render", document.activeElement === button(long), document.activeElement?.className);

		button(long).click();
		await h.sleep(500);
		h.check("Show less shortens it again", body(long).classList.contains("is-clamped") && button(long).textContent === "Read more");

		// --- the topic context ---------------------------------------------------------------------------------
		const context = document.querySelector(".unistoria-topic-context");
		const contextButton = context.nextElementSibling;
		h.check("a long topic context is shortened too", context.classList.contains("is-clamped") && contextButton?.classList.contains("unistoria-read-more") && visible(contextButton));

		// --- late growth: content that gets taller after the first render is detected -------------------------------
		// ResizeObserver does not run while the Obsidian window is hidden or minimized, so this check
		// is only meaningful with the window visible.
		const grow = body(short).querySelector(".unistoria-message-content");
		grow.insertAdjacentHTML("beforeend", `<div style="height:${LIMIT + 200}px"></div>`);
		await h.sleep(800);
		if (document.hidden) h.note("late growth", "skipped: the Obsidian window is hidden, so ResizeObserver does not run");
		else h.check("content that grows after rendering gets an excerpt", body(short).classList.contains("is-clamped") && visible(button(short)));
	} finally {
		for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		await h.cleanup();
	}
	return h.report();
};
