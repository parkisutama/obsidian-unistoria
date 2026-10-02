import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import esbuild from "esbuild";
import { buildLicenseBanner } from "./scripts/license-banner.mjs";
import { copyToVault, readVaultPluginPath } from "./scripts/vault-copy.mjs";

const prod = process.argv[2] === "production";
const DIST_DIR = "dist";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const banner = buildLicenseBanner(manifest.version);

// Completes dist/ with the manifest, then copies the artifacts into the vault plugin folder named
// by OBSIDIAN_VAULT_PLUGIN_PATH in .env. Without that variable (CI, fresh clone) the copy is skipped.
const publishProblems = [];
const publishPlugin = {
	name: "publish-artifacts",
	setup(build) {
		build.onEnd((result) => {
			publishProblems.length = 0;
			if (result.errors.length > 0) return;

			mkdirSync(DIST_DIR, { recursive: true });
			copyFileSync("manifest.json", `${DIST_DIR}/manifest.json`);

			const pluginDir = readVaultPluginPath();
			if (!pluginDir) {
				console.log("OBSIDIAN_VAULT_PLUGIN_PATH not set; skipping vault copy");
				return;
			}
			try {
				const destination = copyToVault({ distDir: DIST_DIR, pluginDir, pluginId: manifest.id });
				console.log(`✓ Copied build to ${destination}`);
			} catch (error) {
				publishProblems.push(error.message);
				console.error(`✗ Vault copy failed: ${error.message}`);
			}
		});
	},
};

const context = await esbuild.context({
	banner: { js: banner, css: banner },
	entryPoints: { main: "src/main.ts", styles: "src/styles/index.css" },
	outdir: DIST_DIR,
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtinModules,
	],
	format: "cjs",
	target: "es2022",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	minify: prod,
	plugins: [publishPlugin],
});

if (prod) {
	await context.rebuild();
	await context.dispose();
	process.exit(publishProblems.length > 0 ? 1 : 0);
} else {
	await context.watch();
}
