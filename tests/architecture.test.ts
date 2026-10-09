// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Architecture guard. Static, regex-based checks for the dependency direction `ui → platform →
// core` (AGENTS.md): pure `core` never imports `obsidian` or an outer layer, `platform` never
// imports `ui`, and only `src/platform/vault` may call a vault write API. The directories fill up
// as the plan progresses; the synthetic cases below prove each rule fails on a violation.

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(repoRoot, "src");

interface SourceFile {
	path: string;
	text: string;
}

const IMPORT_SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

const VAULT_WRITE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
	{ name: "processFrontMatter", pattern: /\.processFrontMatter\s*\(/ },
	{ name: "vault.create", pattern: /vault\.create(?:Folder|Binary)?\s*\(/ },
	{ name: "vault.modify", pattern: /vault\.modify(?:Binary)?\s*\(/ },
	{ name: "vault.process", pattern: /vault\.process\s*\(/ },
	{ name: "vault.append", pattern: /vault\.append\s*\(/ },
	{ name: "vault.delete", pattern: /vault\.delete\s*\(/ },
	{ name: "vault.trash", pattern: /vault\.trash\s*\(/ },
	{ name: "vault.rename", pattern: /vault\.rename\s*\(/ },
	{ name: "trashFile", pattern: /\.trashFile\s*\(/ },
	{ name: "renameFile", pattern: /\.renameFile\s*\(/ },
];

const VAULT_WRITE_ALLOWED_DIR = "src/platform/vault/";

function layerOf(filePath: string): string | null {
	return /^src\/(core|platform|ui|settings)\//.exec(filePath)?.[1] ?? null;
}

/** Resolves a relative import to a repo-relative posix path; bare specifiers are returned as is. */
function resolveImport(fromPath: string, specifier: string): string {
	if (!specifier.startsWith(".")) return specifier;
	return path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
}

function findViolations(files: SourceFile[]): string[] {
	const violations: string[] = [];
	for (const file of files) {
		const layer = layerOf(file.path);
		for (const match of file.text.matchAll(IMPORT_SPECIFIER)) {
			const target = resolveImport(file.path, match[1] ?? "");
			const targetLayer = layerOf(`${target}/`);
			if (layer === "core" && (target === "obsidian" || (targetLayer && targetLayer !== "core"))) {
				violations.push(`${file.path}: core imports ${target}`);
			}
			if (layer === "platform" && targetLayer === "ui") {
				violations.push(`${file.path}: platform imports ${target}`);
			}
		}
		if (!file.path.startsWith(VAULT_WRITE_ALLOWED_DIR)) {
			for (const { name, pattern } of VAULT_WRITE_PATTERNS) {
				if (pattern.test(file.text)) violations.push(`${file.path}: calls ${name}`);
			}
		}
	}
	return violations;
}

function readSources(dir: string): SourceFile[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((entry) => {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) return readSources(full);
		if (!entry.endsWith(".ts")) return [];
		return [
			{
				path: path.relative(repoRoot, full).split(path.sep).join("/"),
				text: readFileSync(full, "utf8"),
			},
		];
	});
}

describe("architecture guard", () => {
	it("finds no violation in src/", () => {
		expect(findViolations(readSources(srcDir))).toEqual([]);
	});

	it("rejects core importing obsidian", () => {
		const files = [{ path: "src/core/thread/tree.ts", text: 'import { TFile } from "obsidian";' }];
		expect(findViolations(files)).toEqual(["src/core/thread/tree.ts: core imports obsidian"]);
	});

	it("rejects core importing an outer layer", () => {
		const files = [
			{ path: "src/core/links/codec.ts", text: 'import { x } from "../../platform/vault/x";' },
		];
		expect(findViolations(files)).toEqual([
			"src/core/links/codec.ts: core imports src/platform/vault/x",
		]);
	});

	it("rejects platform importing ui", () => {
		const files = [
			{ path: "src/platform/index/a.ts", text: 'import { v } from "../../ui/views/v";' },
		];
		expect(findViolations(files)).toEqual([
			"src/platform/index/a.ts: platform imports src/ui/views/v",
		]);
	});

	it("rejects vault writes outside src/platform/vault", () => {
		const files = [
			{ path: "src/ui/views/v.ts", text: "await this.app.vault.create(path, text);" },
			{ path: "src/platform/editor/e.ts", text: "app.fileManager.processFrontMatter(file, fn);" },
		];
		expect(findViolations(files)).toEqual([
			"src/ui/views/v.ts: calls vault.create",
			"src/platform/editor/e.ts: calls processFrontMatter",
		]);
	});

	it("allows the permitted directions and the vault adapter", () => {
		const files = [
			{ path: "src/core/thread/tree.ts", text: 'import { parse } from "../schema/message";' },
			{
				path: "src/ui/views/v.ts",
				text: 'import { index } from "../../platform/index/a";\nimport { ItemView } from "obsidian";',
			},
			{ path: "src/platform/vault/write.ts", text: "await app.vault.create(path, text);" },
		];
		expect(findViolations(files)).toEqual([]);
	});
});
