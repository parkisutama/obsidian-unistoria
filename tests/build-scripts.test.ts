import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildLicenseBanner } from "../scripts/license-banner.mjs";
import {
	BUILD_ARTIFACTS,
	copyToVault,
	deployToVault,
	readVaultPluginPath,
	runDeploy,
} from "../scripts/vault-copy.mjs";
import { verifyArtifacts } from "../scripts/verify-artifacts.mjs";

let workDir: string;

beforeEach(() => {
	workDir = mkdtempSync(path.join(tmpdir(), "unistoria-"));
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
});

function writeDist(overrides: Record<string, string> = {}): string {
	const distDir = path.join(workDir, "dist");
	mkdirSync(distDir, { recursive: true });
	const manifest = {
		id: "unistoria",
		version: "0.1.0",
		minAppVersion: "1.14.2",
		isDesktopOnly: true,
	};
	const files: Record<string, string> = {
		"main.js": `${buildLicenseBanner("0.1.0")}\nmodule.exports = {};`,
		"styles.css": `${buildLicenseBanner("0.1.0")}\n.unistoria-view {}`,
		"manifest.json": JSON.stringify(manifest),
		...overrides,
	};
	for (const [name, text] of Object.entries(files)) writeFileSync(path.join(distDir, name), text);
	writeFileSync(path.join(workDir, "package.json"), JSON.stringify({ version: "0.1.0" }));
	writeFileSync(path.join(workDir, "versions.json"), JSON.stringify({ "0.1.0": "1.14.2" }));
	return distDir;
}

describe("readVaultPluginPath", () => {
	it("returns null without an .env file or without the key", () => {
		expect(readVaultPluginPath(path.join(workDir, ".env"))).toBeNull();
		writeFileSync(path.join(workDir, ".env"), "OTHER=1\nOBSIDIAN_VAULT_PLUGIN_PATH=\n");
		expect(readVaultPluginPath(path.join(workDir, ".env"))).toBeNull();
	});

	it("keeps Windows backslashes intact", () => {
		const value = "E:\\vault\\.obsidian\\plugins\\unistoria";
		writeFileSync(path.join(workDir, ".env"), `OBSIDIAN_VAULT_PLUGIN_PATH=${value}\n`);
		expect(readVaultPluginPath(path.join(workDir, ".env"))).toBe(value);
	});
});

describe("copyToVault", () => {
	it("copies every artifact into a folder named after the plugin ID", () => {
		const distDir = writeDist();
		const pluginsDir = path.join(workDir, "vault", ".obsidian", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		const pluginDir = path.join(pluginsDir, "unistoria");

		copyToVault({ distDir, pluginDir, pluginId: "unistoria" });

		for (const file of BUILD_ARTIFACTS) {
			expect(readFileSync(path.join(pluginDir, file), "utf8")).toBe(
				readFileSync(path.join(distDir, file), "utf8"),
			);
		}
	});

	it("refuses a folder whose name is not the plugin ID", () => {
		const distDir = writeDist();
		const pluginDir = path.join(workDir, "plugins", "unimian");
		mkdirSync(pluginDir, { recursive: true });

		expect(() => copyToVault({ distDir, pluginDir, pluginId: "unistoria" })).toThrow(
			/expected "unistoria"/,
		);
		expect(existsSync(path.join(pluginDir, "main.js"))).toBe(false);
	});

	it("refuses to create a missing plugins folder", () => {
		const distDir = writeDist();
		const pluginDir = path.join(workDir, "no-vault", "plugins", "unistoria");

		expect(() => copyToVault({ distDir, pluginDir, pluginId: "unistoria" })).toThrow(
			/does not exist/,
		);
		expect(existsSync(pluginDir)).toBe(false);
	});
});

describe("verifyArtifacts", () => {
	it("accepts a complete build", () => {
		writeDist();
		expect(verifyArtifacts({ rootDir: workDir })).toEqual([]);
	});

	it("reports a missing banner and a wrong plugin ID", () => {
		writeDist({ "main.js": "module.exports = {};" });
		expect(
			verifyArtifacts({ rootDir: workDir }).some((p) => p.startsWith("main.js: license banner")),
		).toBe(true);

		writeDist({
			"manifest.json": JSON.stringify({ id: "other", version: "0.1.0", isDesktopOnly: false }),
		});
		const problems = verifyArtifacts({ rootDir: workDir });
		expect(problems).toContain('manifest.json: id is "other", expected "unistoria"');
		expect(problems).toContain("manifest.json: isDesktopOnly must be true");
	});

	it("reports missing artifacts", () => {
		expect(verifyArtifacts({ rootDir: workDir })).toEqual(
			BUILD_ARTIFACTS.map((file) => `${file}: missing`),
		);
	});
});

describe("deployToVault", () => {
	it("fails when the vault path is not configured", () => {
		const distDir = writeDist();
		expect(() =>
			deployToVault({ envPath: path.join(workDir, ".env"), distDir, pluginId: "unistoria" }),
		).toThrow(/OBSIDIAN_VAULT_PLUGIN_PATH is not set/);
	});

	it("copies the build to the vault named in .env", () => {
		const distDir = writeDist();
		const pluginsDir = path.join(workDir, "vault", ".obsidian", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		const pluginDir = path.join(pluginsDir, "unistoria");
		writeFileSync(path.join(workDir, ".env"), `OBSIDIAN_VAULT_PLUGIN_PATH=${pluginDir}\n`);

		const destination = deployToVault({
			envPath: path.join(workDir, ".env"),
			distDir,
			pluginId: "unistoria",
		});

		expect(destination).toBe(path.resolve(pluginDir));
		for (const artifact of BUILD_ARTIFACTS) {
			expect(existsSync(path.join(pluginDir, artifact))).toBe(true);
		}
	});
});

describe("runDeploy", () => {
	const silent = () => {
		const lines: string[] = [];
		return {
			lines,
			log: (line: string) => lines.push(line),
			error: (line: string) => lines.push(line),
		};
	};

	it("returns 1 and explains when no vault is configured", () => {
		writeDist();
		writeFileSync(path.join(workDir, "manifest.json"), JSON.stringify({ id: "unistoria" }));
		const log = silent();
		expect(runDeploy({ rootDir: workDir, log })).toBe(1);
		expect(log.lines.join(" ")).toMatch(/OBSIDIAN_VAULT_PLUGIN_PATH is not set/);
	});

	it("returns 0 after copying dist/ to the configured vault", () => {
		writeDist();
		writeFileSync(path.join(workDir, "manifest.json"), JSON.stringify({ id: "unistoria" }));
		const pluginDir = path.join(workDir, "vault", ".obsidian", "plugins", "unistoria");
		mkdirSync(path.dirname(pluginDir), { recursive: true });
		writeFileSync(path.join(workDir, ".env"), `OBSIDIAN_VAULT_PLUGIN_PATH=${pluginDir}\n`);
		const log = silent();
		expect(runDeploy({ rootDir: workDir, log })).toBe(0);
		expect(existsSync(path.join(pluginDir, "main.js"))).toBe(true);
	});
});
