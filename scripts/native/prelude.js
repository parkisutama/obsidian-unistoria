// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Helpers shared by the native acceptance scripts. The runner pastes this file in front of each
// script, inside Obsidian, so it uses Obsidian's global `app`.

const h = {
	ROOT: "_unistoria-test",
	checks: [],
	notes: {},
	P: app.plugins.plugins.unistoria,
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

	check(name, pass, detail) {
		h.checks.push({
			name,
			pass: Boolean(pass),
			detail: detail === undefined ? "" : String(detail),
		});
	},
	note(key, value) {
		h.notes[key] = value;
	},
	report() {
		return { checks: h.checks, notes: h.notes };
	},

	enc: (s) => s.replace(/%/g, "%25").replace(/ /g, "%20"),
	rel(from, to) {
		const f = from.split("/").slice(0, -1);
		const t = to.split("/");
		const td = t.slice(0, -1);
		let c = 0;
		while (c < f.length && c < td.length && f[c] === td[c]) c++;
		const up = f.length - c;
		const rest = t.slice(c).join("/");
		return up === 0 ? `./${rest}` : `${"../".repeat(up)}${rest}`;
	},
	link(text, from, to) {
		return `[${text}](${h.enc(h.rel(from, to))})`;
	},

	async mkdirs(path) {
		let cur = "";
		for (const part of path.split("/")) {
			cur = cur ? `${cur}/${part}` : part;
			if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur);
		}
	},

	/** Creates `<ROOT>/<space>/<name>/` with a Folder Note and an empty messages folder. */
	async topic(space, name, status = "open") {
		const dir = `${h.ROOT}/${space}/${name}`;
		await h.mkdirs(`${dir}/messages`);
		const notePath = `${dir}/${name}.md`;
		await app.vault.create(
			notePath,
			`---\ntype: discussion-topic\ntopic_id: topic-${h.id()}\nstatus: ${status}\ncreated: 2026-10-02T08:00:00\nupdated: 2026-10-02T08:00:00\n---\n\nContext\n`,
		);
		return { dir, folder: dir, notePath, name, messages: `${dir}/messages` };
	},

	idCounter: 0,
	id() {
		h.idCounter++;
		return `${Date.now().toString(16).slice(-6)}${String(h.idCounter).padStart(6, "0")}`;
	},

	/** Creates a message file. `parent` is the parent's path, or null for a root message. */
	async message(topic, file, { parent = null, status = "published", body = "Body", at = 0 } = {}) {
		const path = `${topic.messages}/${file}.md`;
		const stamp = new Date(Date.UTC(2026, 9, 2, 8, 0, 0) + at * 1000).toISOString().slice(0, 19);
		const text = `---\ntype: discussion-message\nmessage_id: msg-${h.id()}\ntopic: "${h.link(topic.name, path, topic.notePath)}"\nparent: "${parent ? h.link("Parent message", path, parent) : ""}"\nstatus: ${status}\ncreated: ${stamp}\nupdated: ${stamp}\nauthor: ""\n---\n\n${body}\n`;
		await app.vault.create(path, text);
		return path;
	},

	async refresh(wait = 700) {
		await h.sleep(wait);
		await h.P.index.rebuild();
	},
	/** Waits for debounced vault events to reach the index. */
	settle: (ms = 1400) => h.sleep(ms),

	snapshot(folder) {
		const t = h.P.index.topic(folder);
		if (!t) return null;
		const nodes = [...t.thread.nodes.values()];
		const snap = {
			roots: t.thread.roots.map((n) => n.path.split("/").pop()),
			orphans: t.thread.orphans.map((n) => n.path.split("/").pop()),
			kinds: t.issues.map((i) => i.kind),
			parentOf: Object.fromEntries(
				nodes.map((n) => [
					n.path.split("/").pop(),
					n.parentPath ? n.parentPath.split("/").pop() : null,
				]),
			),
		};
		// The topic object is large; keep it out of JSON reports.
		Object.defineProperty(snap, "t", { value: t, enumerable: false });
		return snap;
	},

	previousMode: null,
	/** Sets the composer mode in memory for this run (not saved to the vault's settings). */
	useComposerMode(mode) {
		if (h.previousMode === null) h.previousMode = h.P.prefs.composerMode;
		h.P.prefs = { ...h.P.prefs, composerMode: mode };
	},

	async cleanup() {
		if (h.previousMode !== null) h.P.prefs = { ...h.P.prefs, composerMode: h.previousMode };
		const f = app.vault.getAbstractFileByPath(h.ROOT);
		if (f) await app.fileManager.trashFile(f);
		await h.sleep(500);
	},
};
