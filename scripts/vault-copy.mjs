import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export const VAULT_PATH_KEY = "OBSIDIAN_VAULT_PLUGIN_PATH";
export const BUILD_ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

/** Reads only the vault plugin path from `.env`; every other key in the file is ignored. */
export function readVaultPluginPath(envPath = ".env") {
	if (!existsSync(envPath)) return null;
	const value = parseEnv(readFileSync(envPath, "utf8"))[VAULT_PATH_KEY];
	return value?.trim() || null;
}

/**
 * Copies the build artifacts into a vault's plugin folder. Refuses any destination whose folder
 * name differs from the plugin ID, or whose parent `plugins` folder does not exist, so a typo in
 * `.env` cannot write into another plugin or create a stray vault structure.
 */
export function copyToVault({ distDir, pluginDir, pluginId }) {
	const destination = path.resolve(pluginDir);
	const folderName = path.basename(destination);
	if (folderName !== pluginId) {
		throw new Error(
			`${VAULT_PATH_KEY} points at folder "${folderName}", expected "${pluginId}" (the plugin ID).`,
		);
	}
	const pluginsDir = path.dirname(destination);
	if (!existsSync(pluginsDir)) {
		throw new Error(`${VAULT_PATH_KEY}: parent folder does not exist: ${pluginsDir}`);
	}
	const missing = BUILD_ARTIFACTS.filter((file) => !existsSync(path.join(distDir, file)));
	if (missing.length > 0) {
		throw new Error(`Missing build artifacts in ${distDir}: ${missing.join(", ")}`);
	}

	mkdirSync(destination, { recursive: true });
	for (const file of BUILD_ARTIFACTS) {
		copyFileSync(path.join(distDir, file), path.join(destination, file));
	}
	return destination;
}
