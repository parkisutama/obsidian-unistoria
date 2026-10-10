// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Plugin settings. Spaces are only pointers to folders: topics, messages, and every
// conversation fact live in the vault's Markdown files, never here (spec §9.3, §12).

/**
 * Where messages are written. `split` opens an ordinary editor pane next to the conversation
 * (full editing environment, ADR-007); `embedded` mounts Obsidian's editor inside the composer dock
 * (ADR-006).
 */
export type ComposerMode = "split" | "embedded";

export interface UnistoriaSettings {
	/** Optional default Space folder, vault-relative. Empty means "ask". */
	defaultSpaceRoot: string;
	/** Space folders the user created or registered, vault-relative. */
	spaces: string[];
	/** Written to `author` of new messages. Empty means unset (spec §13). */
	author: string;
	composerMode: ComposerMode;
}

export const DEFAULT_SETTINGS: UnistoriaSettings = {
	defaultSpaceRoot: "",
	spaces: [],
	author: "",
	composerMode: "split",
};

const clean = (path: string) => path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

/** Builds valid settings from whatever was stored, ignoring unknown or malformed fields. */
export function mergeSettings(raw: unknown): UnistoriaSettings {
	const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
	const spaces = Array.isArray(data.spaces)
		? data.spaces.filter((s): s is string => typeof s === "string").map(clean)
		: [];
	return {
		defaultSpaceRoot:
			typeof data.defaultSpaceRoot === "string"
				? clean(data.defaultSpaceRoot)
				: DEFAULT_SETTINGS.defaultSpaceRoot,
		spaces: [...new Set(spaces.filter((s) => s !== ""))],
		author: typeof data.author === "string" ? data.author : DEFAULT_SETTINGS.author,
		composerMode:
			data.composerMode === "split" || data.composerMode === "embedded"
				? data.composerMode
				: DEFAULT_SETTINGS.composerMode,
	};
}

/** Returns a copy with the Space registered once; the vault root is never a registered Space. */
export function withSpace(settings: UnistoriaSettings, path: string): UnistoriaSettings {
	const space = clean(path);
	if (space === "" || settings.spaces.includes(space)) return settings;
	return { ...settings, spaces: [...settings.spaces, space] };
}

/**
 * Returns a copy whose pointers follow a folder from `oldPath` to `newPath`: a Space at that
 * folder or below it, and the default Space. Nothing in the vault is read or written.
 */
export function withSpaceMoved(
	settings: UnistoriaSettings,
	oldPath: string,
	newPath: string,
): UnistoriaSettings {
	const from = clean(oldPath);
	const to = clean(newPath);
	if (from === "" || to === "" || from === to) return settings;
	const follow = (path: string) =>
		path === from ? to : path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
	const spaces = [...new Set(settings.spaces.map(follow))];
	const defaultSpaceRoot = follow(settings.defaultSpaceRoot);
	const unchanged =
		defaultSpaceRoot === settings.defaultSpaceRoot &&
		spaces.length === settings.spaces.length &&
		spaces.every((space, i) => space === settings.spaces[i]);
	return unchanged ? settings : { ...settings, spaces, defaultSpaceRoot };
}

/** Space folders offered when creating a topic, default first, without duplicates. */
export function spaceChoices(settings: UnistoriaSettings): string[] {
	const list = settings.defaultSpaceRoot
		? [settings.defaultSpaceRoot, ...settings.spaces]
		: settings.spaces;
	return [...new Set(list)];
}
