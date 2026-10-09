// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { describe, expect, it } from "vitest";
import { canReplyTo, canTransition } from "../../src/core/lifecycle/lifecycle";

describe("canTransition", () => {
	it("allows publishing a draft with a body", () => {
		expect(canTransition("draft", "published", "hello")).toEqual({ ok: true });
	});

	it("refuses to publish an empty or whitespace-only body", () => {
		expect(canTransition("draft", "published", "")).toEqual({ ok: false, reason: "empty-body" });
		expect(canTransition("draft", "published", " \n\t ")).toEqual({
			ok: false,
			reason: "empty-body",
		});
	});

	it("allows removing a published message and restoring it", () => {
		expect(canTransition("published", "removed", "x")).toEqual({ ok: true });
		expect(canTransition("removed", "published", "x")).toEqual({ ok: true });
	});

	it("does not require a body to remove or restore", () => {
		expect(canTransition("published", "removed", "")).toEqual({ ok: true });
	});

	it.each([
		["draft", "removed"],
		["published", "draft"],
		["removed", "draft"],
		["draft", "draft"],
		["published", "published"],
		["removed", "removed"],
	] as const)("refuses %s -> %s", (from, to) => {
		expect(canTransition(from, to, "x")).toEqual({ ok: false, reason: "not-allowed" });
	});
});

describe("canReplyTo", () => {
	it("allows replies only to published messages", () => {
		expect(canReplyTo("published")).toBe(true);
		expect(canReplyTo("draft")).toBe(false);
		expect(canReplyTo("removed")).toBe(false);
	});
});
