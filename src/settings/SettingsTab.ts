// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { type App, PluginSettingTab, Setting } from "obsidian";
import type UnistoriaPlugin from "../main";
import { mergeSettings } from "./settings";

export class UnistoriaSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: UnistoriaPlugin,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Author")
			.setDesc(
				"Written to new messages. Optional: Unistoria does not authenticate anyone, so this is only a label.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Your name")
					.setValue(this.plugin.prefs.author)
					.onChange(async (value) => {
						this.plugin.prefs = mergeSettings({ ...this.plugin.prefs, author: value });
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Editor")
			.setDesc(
				"Where you write a message. The editor pane is Obsidian's normal editor next to the conversation, with all your plugins and hotkeys. The embedded editor sits inside the conversation.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("split", "Editor pane next to the conversation")
					.addOption("embedded", "Embedded below the conversation")
					.setValue(this.plugin.prefs.composerMode)
					.onChange(async (value) => {
						this.plugin.prefs = mergeSettings({ ...this.plugin.prefs, composerMode: value });
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default space folder")
			.setDesc("Preselected when creating a topic. Leave empty to choose each time.")
			.addText((text) =>
				text
					.setPlaceholder("Spaces/Project")
					.setValue(this.plugin.prefs.defaultSpaceRoot)
					.onChange(async (value) => {
						this.plugin.prefs = mergeSettings({ ...this.plugin.prefs, defaultSpaceRoot: value });
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Spaces").setHeading();
		if (this.plugin.prefs.spaces.length === 0) {
			containerEl.createEl("p", { text: "No spaces yet. Use the Create space command." });
		}
		for (const space of this.plugin.prefs.spaces) {
			new Setting(containerEl)
				.setName(space)
				.setDesc(
					"Forgetting a space removes it from this list only. Its folder and files are not touched.",
				)
				.addButton((button) =>
					button.setButtonText("Forget").onClick(async () => {
						this.plugin.prefs = mergeSettings({
							...this.plugin.prefs,
							spaces: this.plugin.prefs.spaces.filter((s) => s !== space),
						});
						await this.plugin.saveSettings();
						this.display();
					}),
				);
		}
	}
}
