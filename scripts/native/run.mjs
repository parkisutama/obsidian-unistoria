// Runs a native acceptance script inside a running Obsidian through its CLI and prints the checks.
//
//   node scripts/native/run.mjs <vault name> <script file> [more script files]
//
// Needs Obsidian open on the named vault with the Unistoria plugin enabled and the Obsidian CLI on
// PATH. Scripts create their fixtures under `_unistoria-test/` in that vault and move the folder to
// the vault trash afterwards. Run them against a vault you are happy to touch.
//
// A script file holds one `async (h) => { ... return h.report(); }` expression; see prelude.js.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [vault, ...scripts] = process.argv.slice(2);
if (!vault || scripts.length === 0) {
	console.error("Usage: node scripts/native/run.mjs <vault name> <script.js> [...]");
	process.exit(2);
}

const prelude = readFileSync(path.join(here, "prelude.js"), "utf8");
const POLL_MS = 1500;
const TIMEOUT_MS = 10 * 60 * 1000;

function eval_(code) {
	return execFileSync("obsidian", [`vault=${vault}`, "eval", `code=${code}`], {
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScript(file) {
	const source = readFileSync(path.resolve(file), "utf8").trim().replace(/;$/, "");
	// Errors keep the checks recorded so far, so a failure shows how far the script got.
	const code = `window.__native = null; (async () => { ${prelude}\ntry { return await (${source})(h); } catch (e) { return { error: String((e && e.stack) || e), checks: h.checks, notes: h.notes }; } })().then((r) => { window.__native = JSON.stringify(r); }).catch((e) => { window.__native = JSON.stringify({ error: String((e && e.stack) || e), checks: [] }); }); "started"`;
	// The CLI mangles long multi-line arguments, so the code goes through a file Obsidian reads itself.
	const tmp = path.join(mkdtempSync(path.join(os.tmpdir(), "unistoria-native-")), "script.js");
	writeFileSync(tmp, code);
	const forwardSlashes = tmp.split(path.sep).join("/");
	eval_(`(0, eval)(window.require("fs").readFileSync(${JSON.stringify(forwardSlashes)}, "utf8"))`);
	const started = Date.now();
	for (;;) {
		await sleep(POLL_MS);
		const state = eval_('window.__native === null ? "PENDING" : "DONE"');
		if (state.includes("DONE")) break;
		if (Date.now() - started > TIMEOUT_MS) throw new Error(`${file}: timed out`);
	}
	const raw = eval_("window.__native").replace(/^=> /, "").trim();
	return JSON.parse(raw);
}

let failed = 0;
for (const file of scripts) {
	console.log(`\n== ${path.basename(file)}`);
	const result = await runScript(file);
	for (const check of result.checks ?? []) {
		console.log(
			`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? `  [${check.detail}]` : ""}`,
		);
		if (!check.pass) failed++;
	}
	if (result.error) {
		console.log(`ERROR ${result.error}`);
		failed++;
	}
	if (result.notes)
		for (const [key, value] of Object.entries(result.notes))
			console.log(`NOTE  ${key}: ${JSON.stringify(value)}`);
}
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
