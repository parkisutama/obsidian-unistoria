import { Plugin } from "obsidian";
import { describe, expect, it } from "vitest";
import UnistoriaPlugin from "../src/main";

describe("plugin entry", () => {
	it("default-exports an Obsidian plugin class", () => {
		expect(Object.getPrototypeOf(UnistoriaPlugin)).toBe(Plugin);
	});
});
