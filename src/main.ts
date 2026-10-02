// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { Plugin } from "obsidian";
import type { MessageStatus, TopicStatus } from "./core/schema/schema";
import { topicFolderOf } from "./core/thread/boundary";
import { createIndexHost, registerIndexEvents } from "./platform/index/obsidian-index";
import { TopicIndex } from "./platform/index/topic-index";
import { createDraftMessage } from "./platform/vault/messages";
import {
	createMutationHost,
	type MutationResult,
	setMessageStatus,
	setTopicStatus,
} from "./platform/vault/mutations";
import { toggleBodyTask } from "./platform/vault/tasks";
import { UnistoriaSettingTab } from "./settings/SettingsTab";
import {
	DEFAULT_SETTINGS,
	mergeSettings,
	type UnistoriaSettings,
	withSpace,
} from "./settings/settings";
import { CreateSpaceModal } from "./ui/modals/CreateSpaceModal";
import { CreateTopicModal } from "./ui/modals/CreateTopicModal";
import { ConversationView, HOVER_SOURCE, VIEW_TYPE } from "./ui/views/ConversationView";

/** Plugin composition root. */
export default class UnistoriaPlugin extends Plugin {
	prefs: UnistoriaSettings = { ...DEFAULT_SETTINGS };
	index!: TopicIndex;

	override async onload(): Promise<void> {
		this.prefs = mergeSettings(await this.loadData());

		this.index = new TopicIndex(createIndexHost(this.app));
		registerIndexEvents(this, this.app, this.index);
		this.app.workspace.onLayoutReady(() => void this.index.rebuild());

		this.registerView(
			VIEW_TYPE,
			(leaf) =>
				new ConversationView(leaf, {
					index: this.index,
					settings: () => this.prefs,
					setStatus: (folder, path, to) => this.setStatus(folder, path, to),
					setTopicStatus: (folder, note, to) => this.setTopicStatus(folder, note, to),
					createDraft: async (folder, parentPath) => {
						const topic = this.index.topic(folder);
						if (!topic) return { ok: false, error: "The topic no longer exists" };
						return createDraftMessage(this.app, {
							topicFolder: folder,
							notePath: topic.notePath,
							parentPath,
							now: new Date(),
							author: this.prefs.author || undefined,
						});
					},
					toggleTask: (topic, path, index, wasChecked) =>
						toggleBodyTask(this.app, topic, path, index, wasChecked),
					openCreateTopic: () => this.openCreateTopic(),
					openCreateSpace: () => this.openCreateSpace(),
				}),
		);

		// Lets Page Preview treat links inside the conversation like links in a note (hover to preview).
		this.registerHoverLinkSource(HOVER_SOURCE, { display: "Unistoria", defaultMod: true });

		this.addCommand({
			id: "open-view",
			name: "Open topics",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "create-space",
			name: "Create space",
			callback: () => this.openCreateSpace(),
		});
		this.addCommand({
			id: "create-topic",
			name: "Create topic",
			callback: () => this.openCreateTopic(),
		});
		this.addRibbonIcon("messages-square", "Open topics", () => void this.activateView());
		this.addRibbonIcon("message-square-plus", "Create topic", () => this.openCreateTopic());
		this.addSettingTab(new UnistoriaSettingTab(this.app, this));
	}

	/** Changes a message status within its topic; the view calls this for Publish, Remove, Restore. */
	setStatus(topicFolder: string, path: string, to: MessageStatus): Promise<MutationResult> {
		return setMessageStatus(createMutationHost(this.app), topicFolder, path, to);
	}

	setTopicStatus(topicFolder: string, notePath: string, to: TopicStatus): Promise<MutationResult> {
		return setTopicStatus(createMutationHost(this.app), topicFolder, notePath, to);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.prefs);
	}

	/** Reveals the conversation view, optionally on a topic and with the composer on a draft. */
	async activateView(topicFolder?: string, composePath?: string): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
		if (topicFolder && leaf.view instanceof ConversationView) {
			await leaf.view.showTopic(topicFolder, composePath);
		}
	}

	private openCreateSpace(): void {
		new CreateSpaceModal(this.app, {
			onCreated: async (path) => {
				this.prefs = withSpace(this.prefs, path);
				await this.saveSettings();
			},
		}).open();
	}

	private openCreateTopic(): void {
		new CreateTopicModal(this.app, {
			settings: () => this.prefs,
			openDraft: async (path) => {
				await this.index.update([path]);
				await this.activateView(topicFolderOf(path), path);
			},
		}).open();
	}
}
