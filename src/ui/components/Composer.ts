// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// The composer dock under the conversation. It shows what is being written and offers Publish and
// Close; the Markdown editor itself is either an ordinary editor pane split off the conversation
// (default, ADR-007) or Obsidian's editor embedded in the dock (ADR-006). The dock lives outside the
// thread, so the thread can re-render without disturbing it.

import { type App, Notice, type WorkspaceLeaf } from "obsidian";
import { openEmbeddedEditor } from "../../platform/editor/embedded-editor";
import { openInTab } from "../../platform/editor/open-file";
import { type EditorSession, openSplitEditor } from "../../platform/editor/split-editor";
import type { MutationResult } from "../../platform/vault/mutations";
import type { ComposerMode } from "../../settings/settings";
import { describeFailure } from "../messages";

export interface ComposerRequest {
	path: string;
	topicFolder: string;
	/** `draft` and `reply` offer Publish; `edit` changes a published message in place. */
	kind: "draft" | "reply" | "edit";
	title: string;
}

export interface ComposerDeps {
	hostLeaf: WorkspaceLeaf;
	mode(): ComposerMode;
	setStatus(topicFolder: string, path: string, to: "published"): Promise<MutationResult>;
	/** Tells screen readers about a change that has no other visible result. */
	announce(text: string): void;
	/** Called after the composer closes, so the conversation can refresh. */
	onClosed(): void;
}

export class Composer {
	private editor: EditorSession | null = null;
	private current: ComposerRequest | null = null;
	private opening = false;

	constructor(
		private readonly app: App,
		private readonly dockEl: HTMLElement,
		private readonly deps: ComposerDeps,
	) {
		this.dockEl.addClass("unistoria-composer-dock");
		this.dockEl.hide();
	}

	isOpenFor(path: string): boolean {
		return this.current?.path === path;
	}

	async open(request: ComposerRequest): Promise<void> {
		if (this.opening) return;
		this.opening = true;
		try {
			await this.close();
			const file = this.app.vault.getFileByPath(request.path);
			if (!file) {
				new Notice("The message file no longer exists.");
				return;
			}
			const split = this.deps.mode() === "split";
			this.current = request;
			this.dockEl.empty();
			this.dockEl.show();
			this.dockEl.toggleClass("is-split", split);
			this.dockEl.setAttribute("role", "region");
			this.dockEl.setAttribute("aria-label", `Composer: ${request.title}`);

			const header = this.dockEl.createDiv({ cls: "unistoria-composer-header" });
			header.createEl("strong", { text: request.title });
			const actions = header.createDiv({ cls: "unistoria-composer-actions" });
			if (split) {
				const focus = actions.createEl("button", { text: "Go to editor" });
				focus.addEventListener("click", () => this.editor?.focus());
			}
			if (request.kind !== "edit") {
				const publish = actions.createEl("button", { text: "Publish", cls: "mod-cta" });
				publish.addEventListener("click", () => void this.publish());
			}
			const done = actions.createEl("button", { text: request.kind === "edit" ? "Done" : "Close" });
			done.addEventListener("click", () => void this.dismiss());

			if (request.kind !== "edit") {
				this.dockEl.createDiv({
					cls: "unistoria-composer-note",
					text: "Unpublished draft. It is saved in the file and is not private: anyone with access to this vault can open it.",
				});
			}
			if (split) {
				this.dockEl.createDiv({
					cls: "unistoria-composer-note",
					text: "Write in the editor pane next to this one. It is Obsidian's normal editor, with all your plugins and hotkeys.",
				});
			}

			const host = split ? null : this.dockEl.createDiv({ cls: "unistoria-composer-editor" });
			this.editor = split
				? await openSplitEditor(this.app, file, this.deps.hostLeaf)
				: await openEmbeddedEditor(this.app, file, this.deps.hostLeaf);
			const editor = this.editor;
			if (editor) {
				if (host && editor.el) host.appendChild(editor.el);
				window.setTimeout(() => editor.focus(), 50);
				this.deps.announce(`Composer opened: ${request.title}`);
			} else {
				(host ?? this.dockEl).createEl("p", {
					text: "The editor could not be opened here.",
				});
				const openTab = (host ?? this.dockEl).createEl("button", { text: "Open in an editor tab" });
				openTab.addEventListener("click", () => void openInTab(this.app, file));
			}
		} finally {
			this.opening = false;
		}
	}

	/** The editor pane was closed by the user: remove the dock, keeping the file as it is. */
	async handleEditorGone(): Promise<void> {
		if (!this.current || !this.editor || this.editor.isOpen()) return;
		const request = this.current;
		await this.close();
		this.deps.announce(`Composer closed: ${request.title}`);
		this.deps.onClosed();
	}

	/** The file being composed was deleted: close the composer instead of leaving it on nothing. */
	async handleDeleted(path: string): Promise<void> {
		if (this.current?.path !== path) return;
		// The file is gone; closing must not try to save into it.
		const editor = this.editor;
		this.editor = null;
		this.current = null;
		this.dockEl.empty();
		this.dockEl.hide();
		if (editor) await editor.close().catch(() => undefined);
		new Notice("The message file was deleted, so the composer was closed.");
		this.deps.onClosed();
	}

	/** The file being composed was renamed or moved: keep following it. */
	handleRenamed(oldPath: string, newPath: string): void {
		if (this.current?.path === oldPath) this.current = { ...this.current, path: newPath };
	}

	/** Saves and removes the editor. The message file stays as it is. */
	async close(): Promise<void> {
		const editor = this.editor;
		this.editor = null;
		this.current = null;
		this.dockEl.empty();
		this.dockEl.hide();
		if (editor) await editor.close();
	}

	private async dismiss(): Promise<void> {
		await this.close();
		this.deps.onClosed();
	}

	private async publish(): Promise<void> {
		const request = this.current;
		if (!request) return;
		try {
			await this.editor?.save();
		} catch (error) {
			new Notice(
				`Could not save the draft: ${error instanceof Error ? error.message : String(error)}`,
			);
			return;
		}
		const result = await this.deps.setStatus(request.topicFolder, request.path, "published");
		if (!result.ok) {
			new Notice(describeFailure(result));
			return;
		}
		new Notice("Published.");
		this.deps.announce("Message published");
		await this.dismiss();
	}
}
