// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, spaceChoices, withSpace } from "../src/settings/settings";

describe("mergeSettings", () => {
	it("falls back to defaults for missing or malformed data", () => {
		expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(mergeSettings("x")).toEqual(DEFAULT_SETTINGS);
		expect(
			mergeSettings({ spaces: "a", author: 3, defaultSpaceRoot: 1, composerMode: "floating" }),
		).toEqual(DEFAULT_SETTINGS);
	});

	it("normalizes paths and drops duplicates, blanks, and non-text entries", () => {
		const result = mergeSettings({
			defaultSpaceRoot: "\\Spaces\\A\\",
			spaces: ["/Spaces/A/", "Spaces/A", "", 5, "B"],
			author: "Parkis",
		});
		expect(result).toEqual({
			defaultSpaceRoot: "Spaces/A",
			spaces: ["Spaces/A", "B"],
			author: "Parkis",
			composerMode: "split",
		});
	});

	it("defaults the editor to a normal editor pane and keeps a valid choice", () => {
		expect(DEFAULT_SETTINGS.composerMode).toBe("split");
		expect(mergeSettings({ composerMode: "embedded" }).composerMode).toBe("embedded");
		expect(mergeSettings({ composerMode: "split" }).composerMode).toBe("split");
	});

	it("ignores unknown fields", () => {
		expect(Object.keys(mergeSettings({ extra: 1 }))).toEqual([
			"defaultSpaceRoot",
			"spaces",
			"author",
			"composerMode",
		]);
	});
});

describe("withSpace", () => {
	it("registers a space once and never the vault root", () => {
		const once = withSpace(DEFAULT_SETTINGS, "/Spaces/A/");
		expect(once.spaces).toEqual(["Spaces/A"]);
		expect(withSpace(once, "Spaces/A")).toBe(once);
		expect(withSpace(once, "")).toBe(once);
	});
});

describe("spaceChoices", () => {
	it("lists the default first without duplicates", () => {
		expect(
			spaceChoices({ ...DEFAULT_SETTINGS, defaultSpaceRoot: "B", spaces: ["A", "B"] }),
		).toEqual(["B", "A"]);
		expect(spaceChoices(DEFAULT_SETTINGS)).toEqual([]);
	});
});
