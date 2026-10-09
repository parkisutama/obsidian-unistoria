// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// H1: rename and move matrix. Every case ends in one of two states: the relationship follows the
// file (Obsidian's link updater), or it is reported as broken. A message is never attached to a
// different parent or topic.

async (h) => {
	const P = h.P;

	/** root a <- reply b <- reply c, in space S. */
	async function build(space, name) {
		const t = await h.topic(space, name);
		const a = await h.message(t, "a", { at: 1 });
		const b = await h.message(t, "b", { parent: a, at: 2 });
		const c = await h.message(t, "c", { parent: b, at: 3 });
		return { t, a, b, c };
	}

	try {
		await h.mkdirs(`${h.ROOT}/S`);
		await h.mkdirs(`${h.ROOT}/Other`);

		// --- link updater on (fileManager.renameFile) ------------------------------------------
		let x = await build("S", "T1");
		await h.refresh();
		let s = h.snapshot(x.t.folder);
		h.check(
			"baseline: a <- b <- c, no issues",
			s.parentOf["b.md"] === "a.md" && s.parentOf["c.md"] === "b.md" && s.kinds.length === 0,
			JSON.stringify(s.parentOf),
		);

		await app.fileManager.renameFile(app.vault.getFileByPath(x.a), `${x.t.messages}/a-renamed.md`);
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"rename root: reply follows, no issues",
			s.parentOf["b.md"] === "a-renamed.md" && s.orphans.length === 0 && s.kinds.length === 0,
			JSON.stringify(s.parentOf),
		);

		await app.fileManager.renameFile(app.vault.getFileByPath(x.b), `${x.t.messages}/b-renamed.md`);
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"rename middle message: child follows",
			s.parentOf["c.md"] === "b-renamed.md" && s.orphans.length === 0,
			JSON.stringify(s.parentOf),
		);

		x = await build("S", "T2");
		await h.refresh();
		await app.fileManager.renameFile(
			app.vault.getFileByPath(x.t.notePath),
			`${x.t.dir}/Renamed note.md`,
		);
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"rename Folder Note: topic still found, links follow",
			s && s.orphans.length === 0 && !s.kinds.includes("topic-link-broken"),
			JSON.stringify(s?.kinds),
		);
		h.check(
			"rename Folder Note: reported as information",
			s?.kinds.includes("topic-note-renamed"),
			JSON.stringify(s?.kinds),
		);

		x = await build("S", "T3");
		await h.refresh();
		await app.fileManager.renameFile(
			app.vault.getAbstractFileByPath(x.t.folder),
			`${h.ROOT}/S/T3 renamed`,
		);
		await h.settle();
		s = h.snapshot(`${h.ROOT}/S/T3 renamed`);
		h.check(
			"rename topic folder: topic follows its folder",
			s && !h.snapshot(x.t.folder),
			"old path present: " + Boolean(h.snapshot(x.t.folder)),
		);
		h.check(
			"rename topic folder: relationships intact",
			s && s.parentOf["b.md"] === "a.md" && s.parentOf["c.md"] === "b.md" && s.orphans.length === 0,
			JSON.stringify(s?.parentOf),
		);

		x = await build("Moving", "T4");
		await h.refresh();
		await app.fileManager.renameFile(
			app.vault.getAbstractFileByPath(`${h.ROOT}/Moving`),
			`${h.ROOT}/Moved space`,
		);
		await h.settle();
		s = h.snapshot(`${h.ROOT}/Moved space/T4`);
		h.check(
			"rename Space folder: topic follows, relationships intact",
			s &&
				s.parentOf["c.md"] === "b.md" &&
				s.orphans.length === 0 &&
				!s.kinds.includes("topic-link-broken"),
			JSON.stringify(s?.kinds),
		);

		x = await build("S", "T5");
		await h.refresh();
		await app.fileManager.renameFile(app.vault.getFileByPath(x.b), `${h.ROOT}/Other/b-moved.md`);
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"move a message out of the topic: it leaves the conversation",
			s && !("b.md" in s.parentOf),
			JSON.stringify(Object.keys(s?.parentOf ?? {})),
		);
		h.check(
			"move a message out: its child is reported, not re-attached",
			s &&
				s.orphans.includes("c.md") &&
				s.parentOf["c.md"] == null &&
				(s.kinds.includes("missing-parent") || s.kinds.includes("parent-outside-topic")),
			JSON.stringify(s?.kinds),
		);
		h.check(
			"move a message out: the moved file is untouched on disk",
			Boolean(app.vault.getFileByPath(`${h.ROOT}/Other/b-moved.md`)),
		);

		x = await build("S", "T6");
		await h.refresh();
		await app.fileManager.renameFile(app.vault.getFileByPath(x.a), `${h.ROOT}/Other/a-moved.md`);
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"move the parent out of the topic: the reply is an orphan",
			s && s.orphans.includes("b.md") && s.kinds.includes("parent-outside-topic"),
			JSON.stringify(s?.kinds),
		);

		// --- link updater bypassed (vault.rename) ----------------------------------------------
		x = await build("S", "T7");
		await h.refresh();
		await app.vault.rename(app.vault.getFileByPath(x.a), `${x.t.messages}/a-raw.md`);
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"rename without the updater: reply is reported as orphan",
			s && s.orphans.includes("b.md") && s.kinds.includes("missing-parent"),
			JSON.stringify(s?.orphans),
		);
		h.check(
			"rename without the updater: the renamed file is not adopted as parent",
			s && s.parentOf["b.md"] == null && s.roots.includes("a-raw.md"),
			JSON.stringify(s?.roots),
		);

		x = await build("S", "T8");
		await h.refresh();
		await app.vault.rename(app.vault.getFileByPath(x.t.notePath), `${h.ROOT}/Other/T8.md`);
		await h.settle();
		h.check(
			"Folder Note moved away: the topic leaves the index, nothing crashes",
			!h.snapshot(x.t.folder),
		);
		h.check(
			"Folder Note moved away: message files are untouched",
			["a", "b", "c"].every((m) => app.vault.getFileByPath(`${x.t.messages}/${m}.md`)),
		);

		x = await build("S", "T9");
		await h.refresh();
		await app.fileManager.trashFile(app.vault.getFileByPath(x.b));
		await h.settle();
		s = h.snapshot(x.t.folder);
		h.check(
			"delete a message: it disappears, the child is an orphan, nothing is recreated",
			s && !("b.md" in s.parentOf) && s.orphans.includes("c.md") && !app.vault.getFileByPath(x.b),
			JSON.stringify(s?.orphans),
		);

		x = await build("S", "T10");
		await h.refresh();
		await app.fileManager.trashFile(app.vault.getFileByPath(x.t.notePath));
		await h.settle();
		h.check(
			"delete the Folder Note: topic gone, not recreated",
			!h.snapshot(x.t.folder) && !app.vault.getFileByPath(x.t.notePath),
		);

		// --- mutations keep working after a rename ----------------------------------------------
		x = await build("S", "T11");
		await h.refresh();
		await app.fileManager.renameFile(app.vault.getFileByPath(x.b), `${x.t.messages}/b-renamed.md`);
		await h.settle();
		const removed = await P.setStatus(x.t.folder, `${x.t.messages}/b-renamed.md`, "removed");
		h.check("status change works on a renamed message", removed.ok, JSON.stringify(removed));
		const outside = await P.setStatus(x.t.folder, `${h.ROOT}/Other/b-moved.md`, "removed");
		h.check(
			"status change refuses a file outside the topic",
			!outside.ok && outside.reason === "outside-topic",
			JSON.stringify(outside),
		);
	} finally {
		await h.cleanup();
	}
	return h.report();
};
