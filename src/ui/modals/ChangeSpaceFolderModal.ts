// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { type App, Modal, Notice, Setting } from "obsidian";
import type { RelocateResult } from "../../platform/vault/spaces";

export interface ChangeSpaceFolderDeps {
	/** Current vault-relative folder of the Space. */
	space: string;
	relocate(to: string): Promise<RelocateResult>;
	onDone(): void;
}

/** Renames or moves the folder of a Space, or points the Space at a folder that already moved. */
export class ChangeSpaceFolderModal extends Modal {
	private path: string;

	constructor(
		app: App,
		private readonly deps: ChangeSpaceFolderDeps,
	) {
		super(app);
		this.path = deps.space;
	}

	override onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Change space folder");
		contentEl.createEl("p", {
			text: "Type a new path to rename or move the folder with all its topics and messages. If you choose a folder that already exists, the space only points to it and no file is moved.",
		});

		const listId = "unistoria-space-folder-list";
		new Setting(contentEl).setName("Folder").addText((text) => {
			text.setValue(this.path).onChange((value) => {
				this.path = value;
			});
			text.inputEl.setAttribute("list", listId);
			text.inputEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter") void this.submit();
			});
			const list = contentEl.createEl("datalist", { attr: { id: listId } });
			for (const folder of this.app.vault.getAllFolders(false)) {
				list.createEl("option", { value: folder.path });
			}
			window.setTimeout(() => {
				text.inputEl.focus();
				text.inputEl.select();
			}, 0);
		});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText("Change folder")
				.setCta()
				.onClick(() => void this.submit()),
		);
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const result = await this.deps.relocate(this.path);
		if (!result.ok) {
			new Notice(`Could not change the folder: ${result.error}`);
			return;
		}
		new Notice(
			result.action === "moved"
				? `Space moved to ${result.path}`
				: `Space now points to ${result.path}. No file was moved.`,
		);
		this.close();
		this.deps.onDone();
	}
}
