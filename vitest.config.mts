import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: [
			// The obsidian package ships types only; tests run against a test double.
			{
				find: /^obsidian$/,
				replacement: fileURLToPath(new URL("./tests/fixtures/obsidian.ts", import.meta.url)),
			},
		],
	},
	test: {
		environment: "happy-dom",
		include: ["tests/**/*.test.ts"],
		// Fail instead of passing silently when a filter or glob matches nothing.
		passWithNoTests: false,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "scripts/**/*.mjs"],
			// Code that exists only to drive Obsidian's own UI and events has no meaningful unit
			// test; it is verified in a real vault (see the native acceptance notes in docs/).
			// Everything with logic of its own stays in scope.
			exclude: [
				"src/main.ts",
				"src/ui/**",
				"src/platform/editor/**",
				"src/platform/index/obsidian-index.ts",
				"src/settings/SettingsTab.ts",
				// Manual acceptance tooling that drives a running Obsidian; it has no unit tests.
				"scripts/native/**",
			],
			reporter: ["text-summary", "lcov"],
			// Ratchet, set just below the numbers measured on 2026-10-02 for the logic code.
			// Raise the floor as coverage grows; never lower it to make a change pass.
			thresholds: { statements: 94, branches: 89, functions: 96, lines: 95 },
		},
	},
});
