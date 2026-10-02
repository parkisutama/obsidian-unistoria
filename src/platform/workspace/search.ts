// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import type { App } from "obsidian";

interface GlobalSearchPlugin {
	instance?: { openGlobalSearch?: (query: string) => void };
}

/**
 * Opens Obsidian's search for a tag, as clicking a tag in reading view does. The tag is written with
 * its leading `#`. Falls back to just opening the search pane if the search plugin has no entry
 * point for a query in this version.
 */
export function openTagSearch(app: App, tag: string): void {
	const normalized = tag.startsWith("#") ? tag : `#${tag}`;
	const internal = (
		app as unknown as {
			internalPlugins?: { getPluginById?: (id: string) => GlobalSearchPlugin | undefined };
		}
	).internalPlugins;
	const search = internal?.getPluginById?.("global-search");
	if (search?.instance?.openGlobalSearch) {
		search.instance.openGlobalSearch(`tag:${normalized}`);
		return;
	}
	(
		app as unknown as { commands: { executeCommandById(id: string): boolean } }
	).commands.executeCommandById("global-search:open");
}
