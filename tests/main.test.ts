// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { Plugin } from "obsidian";
import { describe, expect, it } from "vitest";
import UnistoriaPlugin from "../src/main";

describe("plugin entry", () => {
	it("default-exports an Obsidian plugin class", () => {
		expect(Object.getPrototypeOf(UnistoriaPlugin)).toBe(Plugin);
	});
});
