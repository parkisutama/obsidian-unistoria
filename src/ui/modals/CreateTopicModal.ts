// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { type App, Modal, Notice, Setting } from "obsidian";
import { cleanupCreated, type RunResult, runPlan } from "../../core/creation/execute";
import { planTopic, type TopicPlan } from "../../core/creation/plan";
import { createVaultIO } from "../../platform/vault/vault-io";
import { spaceChoices, type UnistoriaSettings } from "../../settings/settings";

export interface CreateTopicDeps {
	settings(): UnistoriaSettings;
	/** Opens the first draft once the topic exists. */
	openDraft(path: string): Promise<void>;
}

const ROOT = "";

/** Creates a topic folder, its Folder Note, `messages/`, and the first draft in one operation. */
export class CreateTopicModal extends Modal {
	private space: string;
	private title = "";
	private description = "";
	private plan: TopicPlan | null = null;
	private previewEl: HTMLElement | null = null;
	private createButton: HTMLButtonElement | null = null;

	constructor(
		app: App,
		private readonly deps: CreateTopicDeps,
		initialSpace?: string,
	) {
		super(app);
		this.space = initialSpace ?? spaceChoices(deps.settings())[0] ?? ROOT;
	}

	override onOpen(): void {
		const { contentEl } = this;
		this.setTitle("Create topic");

		const choices = spaceChoices(this.deps.settings());
		new Setting(contentEl).setName("Space").addDropdown((dropdown) => {
			if (!choices.includes(this.space) && this.space !== ROOT) choices.unshift(this.space);
			for (const choice of choices) dropdown.addOption(choice, choice);
			dropdown.addOption(ROOT, "(vault root)");
			dropdown.setValue(this.space).onChange((value) => {
				this.space = value;
				this.refresh();
			});
		});

		new Setting(contentEl).setName("Title").addText((text) => {
			text.setPlaceholder("What is this conversation about?").onChange((value) => {
				this.title = value;
				this.refresh();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(contentEl)
			.setName("Context")
			.setDesc("Optional. Written to the topic note, not to a message.")
			.addTextArea((area) => {
				area.onChange((value) => {
					this.description = value;
				});
			});

		this.previewEl = contentEl.createDiv({ cls: "unistoria-create-preview" });

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText("Create topic")
				.setCta()
				.onClick(() => void this.submit());
			this.createButton = button.buttonEl;
		});
		this.refresh();
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private currentPlan() {
		return planTopic({
			spacePath: this.space,
			title: this.title,
			description: this.description,
			now: new Date(),
		});
	}

	private refresh(): void {
		const preview = this.previewEl;
		if (!preview) return;
		preview.empty();
		const result = this.currentPlan();
		if (!result.ok) {
			if (this.title.trim() !== "") {
				preview.setText(
					result.reason === "reserved"
						? "That title is a reserved system name. Choose another."
						: "The title has no usable characters.",
				);
			}
			if (this.createButton) this.createButton.disabled = true;
			return;
		}
		if (this.createButton) this.createButton.disabled = false;
		preview.createEl("div", { text: `Folder: ${result.plan.folderPath}` });
		if (result.plan.titleChanged) {
			preview.createEl("div", {
				text: "The title was adjusted: characters that cannot be stored or linked were removed.",
				cls: "mod-warning",
			});
		}
	}

	private async submit(): Promise<void> {
		const result = this.currentPlan();
		if (!result.ok) return;
		this.plan = result.plan;
		await this.execute(false);
	}

	private async execute(resume: boolean): Promise<void> {
		const plan = this.plan;
		if (!plan) return;
		const io = createVaultIO(this.app);
		const outcome = await runPlan(plan, io, { resume });
		if (outcome.ok) {
			this.close();
			new Notice(`Created topic: ${plan.topicName}`);
			await this.deps.openDraft(plan.messagePath);
			return;
		}
		this.showFailure(plan, outcome);
	}

	private showFailure(plan: TopicPlan, outcome: Exclude<RunResult, { ok: true }>): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle("Topic was not fully created");
		contentEl.createEl("p", {
			text:
				outcome.reason === "conflict"
					? `Nothing was written. ${outcome.path} already exists and was left untouched. Choose another title or space.`
					: `Writing ${outcome.path} failed: ${outcome.error}`,
		});
		if (outcome.created.length > 0) {
			contentEl.createEl("p", { text: "These items were created before the failure:" });
			const list = contentEl.createEl("ul");
			for (const item of outcome.created) list.createEl("li", { text: item.path });
		}

		const actions = new Setting(contentEl);
		if (outcome.reason === "conflict") {
			actions.addButton((button) =>
				button.setButtonText("Back").onClick(() => {
					contentEl.empty();
					this.onOpen();
				}),
			);
		} else {
			actions.addButton((button) =>
				button
					.setButtonText("Retry")
					.setCta()
					.onClick(() => void this.execute(true)),
			);
			if (outcome.created.length > 0) {
				actions.addButton((button) =>
					button.setButtonText("Clean up").onClick(async () => {
						const cleaned = await cleanupCreated(outcome.created, createVaultIO(this.app));
						new Notice(
							cleaned.kept.length === 0
								? `Removed ${cleaned.removed.length} item(s).`
								: `Removed ${cleaned.removed.length}; kept ${cleaned.kept.length} changed or non-empty item(s).`,
						);
						this.close();
					}),
				);
			}
		}
		actions.addButton((button) => button.setButtonText("Close").onClick(() => this.close()));
		void plan;
	}
}
