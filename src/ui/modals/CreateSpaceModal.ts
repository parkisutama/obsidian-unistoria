// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { type App, Modal, Notice, Setting } from "obsidian";
import { ensureFolder } from "../../platform/vault/vault-io";

export interface CreateSpaceDeps {
	/** Called with the chosen vault-relative folder after it exists. */
	onCreated(path: string): Promise<void>;
}

/** Creates a Space: a plain folder that holds topic folders. No setup wizard, no schema. */
export class CreateSpaceModal extends Modal {
	private path = "";

	constructor(
		app: App,
		private readonly deps: CreateSpaceDeps,
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Create space");
		contentEl.createEl("p", {
			text: "A space is a folder that holds topics. Choose an existing folder or type a new folder path.",
		});

		const listId = "unistoria-folder-list";
		new Setting(contentEl).setName("Folder").addText((text) => {
			text.setPlaceholder("Spaces/Project").onChange((value) => {
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
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText("Create space")
				.setCta()
				.onClick(() => void this.submit()),
		);
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const path = this.path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
		if (path === "") {
			new Notice("Enter a folder path for the space.");
			return;
		}
		try {
			await ensureFolder(this.app, path);
			await this.deps.onCreated(path);
			new Notice(`Space ready: ${path}`);
			this.close();
		} catch (error) {
			new Notice(
				`Could not create the space: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
