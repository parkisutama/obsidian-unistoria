// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { assertInsideVault, escapesVault } from "../src/core/identity/vault-path";
import { createVaultIO, ensureFolder } from "../src/platform/vault/vault-io";
import { fakeApp } from "./fixtures/fake-app";

describe("escapesVault", () => {
	it.each(["../Outside.md", "Space/../../Outside", "Space/..", "..", "Space\\..\\..\\Outside"])(
		"flags %s",
		(path) => {
			expect(escapesVault(path)).toBe(true);
		},
	);

	it.each(["", "Space", "Space/Topic/messages", "Space/..hidden", "Space/a..b.md", "Space/..."])(
		"accepts %s",
		(path) => {
			expect(escapesVault(path)).toBe(false);
		},
	);
});

describe("assertInsideVault", () => {
	it("throws with the offending path", () => {
		expect(() => assertInsideVault("Space/../../Outside")).toThrow(
			'Path leaves the vault: "Space/../../Outside"',
		);
	});

	it("returns the path when it stays inside", () => {
		expect(assertInsideVault("Space/Topic")).toBe("Space/Topic");
	});
});

describe("vault writes refuse paths that leave the vault", () => {
	it("creates no folder for a space path with a parent-directory segment", async () => {
		const { app, entries } = fakeApp();
		await expect(ensureFolder(app, "Spaces/../../Outside")).rejects.toThrow(/leaves the vault/);
		expect([...entries.keys()]).toEqual([]);
	});

	it("creates no folder and no file through the creation IO", async () => {
		const { app, entries } = fakeApp();
		const io = createVaultIO(app);
		await expect(io.createFolder("../Outside")).rejects.toThrow(/leaves the vault/);
		await expect(io.createFile("../Outside.md", "x")).rejects.toThrow(/leaves the vault/);
		expect([...entries.keys()]).toEqual([]);
	});
});
