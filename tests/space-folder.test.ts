// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { relocateSpaceFolder } from "../src/platform/vault/spaces";
import { createVaultIO, ensureFolder } from "../src/platform/vault/vault-io";
import { fakeApp } from "./fixtures/fake-app";

async function vaultWithSpace() {
	const fake = fakeApp();
	await ensureFolder(fake.app, "Spaces/Alpha/Topic");
	await createVaultIO(fake.app).createFile("Spaces/Alpha/Topic/Topic.md", "note");
	return fake;
}

describe("relocateSpaceFolder", () => {
	it("moves the folder with everything in it, creating missing parents", async () => {
		const { app, entries } = await vaultWithSpace();
		expect(await relocateSpaceFolder(app, "Spaces/Alpha", "Work/Rooms/Beta")).toEqual({
			ok: true,
			action: "moved",
			path: "Work/Rooms/Beta",
		});
		expect(entries.has("Spaces/Alpha")).toBe(false);
		expect(entries.get("Work/Rooms/Beta/Topic/Topic.md")?.content).toBe("note");
	});

	it("only repoints when the destination folder already exists", async () => {
		const { app, entries } = await vaultWithSpace();
		await ensureFolder(app, "Renamed");
		const before = [...entries.keys()];
		expect(await relocateSpaceFolder(app, "Spaces/Alpha", "/Renamed/")).toEqual({
			ok: true,
			action: "repointed",
			path: "Renamed",
		});
		expect([...entries.keys()]).toEqual(before);
	});

	it("repoints a stale pointer whose folder was renamed outside the plugin", async () => {
		const { app } = await vaultWithSpace();
		expect(await relocateSpaceFolder(app, "Gone", "Spaces/Alpha")).toMatchObject({
			ok: true,
			action: "repointed",
		});
	});

	it("refuses without writing when there is nothing to move or point at", async () => {
		const { app, entries } = await vaultWithSpace();
		const before = [...entries.keys()];
		for (const [from, to] of [
			["Gone", "Nowhere"],
			["Spaces/Alpha", ""],
			["Spaces/Alpha", "Spaces/Alpha"],
			["Spaces/Alpha", "../Outside"],
			["Spaces/Alpha", "Spaces/Alpha/Inner"],
			["Spaces/Alpha", "Spaces/Alpha/Topic/Topic.md"],
			["Spaces/Alpha", "Spaces/Alpha/Topic/Topic.md/Under"],
		] as const) {
			expect((await relocateSpaceFolder(app, from, to)).ok, `${from} -> ${to}`).toBe(false);
		}
		expect([...entries.keys()]).toEqual(before);
	});
});
