// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// H4: render time for a large topic. Creates a topic with many messages in a branching thread
// (depth up to 12), then times a full render of the topic page and of its largest thread in the
// panel (ADR-008), and counts the DOM nodes.
// The numbers are printed as notes; checks only enforce generous upper bounds so a regression
// that makes the view unusable is caught. Raise the size with the SIZES array to probe further.

async (h) => {
	const P = h.P;
	const SIZES = [100, 400];
	const BUDGET_MS = { 100: 3000, 400: 8000 };
	try {
		for (const n of SIZES) {
			const t = await h.topic("Perf", `Topic ${n}`);
			const paths = [];
			for (let i = 0; i < n; i++) {
				// Every third message is a root; the rest reply to an earlier message, capped at depth ~12.
				const parent =
					i % 3 === 0 || paths.length === 0 ? null : paths[Math.max(0, paths.length - 1 - (i % 5))];
				const depth = parent ? (paths.depthOf?.[parent] ?? 0) + 1 : 0;
				const p = await h.message(t, `m${String(i).padStart(4, "0")}`, {
					parent: depth > 11 ? null : parent,
					at: i,
					body: `Message ${i}\n\nSome **markdown** with a [link](https://example.com) and a list:\n\n- one\n- two`,
				});
				paths.push(p);
				paths.depthOf = paths.depthOf ?? {};
				paths.depthOf[p] = depth > 11 ? 0 : depth;
			}
			await h.refresh(1500);
			const snap = h.snapshot(t.folder);
			h.check(
				`topic ${n}: all messages indexed`,
				Object.keys(snap.parentOf).length === n,
				Object.keys(snap.parentOf).length,
			);

			await P.activateView(t.folder);
			await h.sleep(1500);
			const view = app.workspace
				.getLeavesOfType("unistoria-conversation")
				.find((l) => l.view.containerEl.ownerDocument === document)?.view;
			view.forceNext = true;
			await view.render();
			const runs = [];
			for (let i = 0; i < 3; i++) {
				view.forceNext = true;
				const start = performance.now();
				await view.render();
				runs.push(Math.round(performance.now() - start));
			}
			const cards = document.querySelectorAll(".unistoria-message").length;
			const nodes = document.querySelector(".unistoria-scroll")?.querySelectorAll("*").length ?? 0;
			const worst = Math.max(...runs);
			h.note(`topic ${n}`, { renderMs: runs, cards, domNodes: nodes });
			h.check(
				`topic ${n}: renders within ${BUDGET_MS[n]} ms`,
				worst <= BUDGET_MS[n],
				`${runs.join(", ")} ms`,
			);
			h.check(
				`topic ${n}: every message that starts a thread is shown`,
				cards === snap.roots.length,
				`${cards}/${snap.roots.length}`,
			);

			// The replies render when a thread opens; time the first thread, which has replies.
			const opener = [...document.querySelectorAll(".unistoria-thread-open")].find(
				(b) => b.textContent !== "Open thread",
			);
			const threadStart = performance.now();
			opener.click();
			for (let i = 0; i < 400 && !document.querySelector(".unistoria-thread-count"); i++)
				await h.sleep(25);
			const inPanel = document.querySelectorAll(".unistoria-replies > li > article").length;
			h.note(`topic ${n} thread`, {
				renderMs: Math.round(performance.now() - threadStart),
				replies: inPanel,
			});
			h.check(`topic ${n}: the thread panel lists replies`, inPanel > 0, inPanel);
			document.querySelector("[data-focus-key='thread-close']").click();
			await h.sleep(400);

			// Autosaving a draft must not rebuild the thread: mark the rendered list, change a draft's
			// file, and check the same element is still in place afterwards.
			const draft = await h.message(t, "zz-draft", { status: "draft", body: "typing", at: n + 1 });
			await h.refresh(1200);
			const marked = document.querySelector(".unistoria-thread");
			marked.__marker = true;
			await app.vault.process(app.vault.getFileByPath(draft), (text) => `${text}\nmore typing\n`);
			await h.sleep(1800);
			h.check(
				`topic ${n}: editing a draft does not re-render the thread`,
				document.querySelector(".unistoria-thread")?.__marker === true,
			);

			const idx = performance.now();
			await P.index.rebuild();
			h.note(`topic ${n} index rebuild ms`, Math.round(performance.now() - idx));
			for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		}
	} finally {
		for (const leaf of app.workspace.getLeavesOfType("unistoria-conversation")) leaf.detach();
		await h.cleanup();
	}
	return h.report();
};
