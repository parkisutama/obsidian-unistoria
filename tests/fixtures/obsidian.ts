// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Test double for the `obsidian` module (aliased in vitest.config.mts). The real package ships
// type declarations only; its runtime is provided by the Obsidian app. Add members here as the
// code under test starts to need them.

export class Component {
	load(): void {}
	unload(): void {}
}

export class Plugin extends Component {}

export class Modal extends Component {
	contentEl = document.createElement("div");
	constructor(public app: unknown) {
		super();
	}
	open(): void {}
	close(): void {}
	setTitle(): this {
		return this;
	}
}

export class Notice {
	constructor(public message: string) {}
}

export class Setting {
	constructor(public containerEl: HTMLElement) {}
}

export function parseYaml(): unknown {
	return null;
}

export const Vault = { recurseChildren(): void {} };

export class ItemView extends Component {
	contentEl = document.createElement("div");
	constructor(public leaf: unknown) {
		super();
	}
}

export class PluginSettingTab {
	containerEl = document.createElement("div");
	constructor(
		public app: unknown,
		public plugin: unknown,
	) {}
}

export class WorkspaceLeaf {}

export class Menu {}

export const MarkdownRenderer = { render: async (): Promise<void> => {} };

export function setIcon(): void {}

export const Keymap = { isModEvent: (): boolean => false };

export class HoverPopover {}
