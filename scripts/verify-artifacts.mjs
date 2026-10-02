import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredNoticeFragments } from "./license-banner.mjs";
import { BUILD_ARTIFACTS } from "./vault-copy.mjs";

export const PLUGIN_ID = "unistoria";
const LICENSED_ARTIFACTS = ["main.js", "styles.css"];
const BANNER_SEARCH_LENGTH = 2000;

/** Returns a list of problems with the build output; an empty list means the build is shippable. */
export function verifyArtifacts({
	rootDir = process.cwd(),
	distDir = path.join(rootDir, "dist"),
} = {}) {
	const problems = [];

	for (const artifact of BUILD_ARTIFACTS) {
		const artifactPath = path.join(distDir, artifact);
		if (!existsSync(artifactPath)) {
			problems.push(`${artifact}: missing`);
		} else if (statSync(artifactPath).size === 0) {
			problems.push(`${artifact}: empty`);
		} else if (LICENSED_ARTIFACTS.includes(artifact)) {
			const head = readFileSync(artifactPath, "utf8").slice(0, BANNER_SEARCH_LENGTH);
			for (const fragment of requiredNoticeFragments()) {
				if (!head.includes(fragment))
					problems.push(`${artifact}: license banner lacks "${fragment}"`);
			}
		}
	}
	if (problems.length > 0) return problems;

	const manifest = JSON.parse(readFileSync(path.join(distDir, "manifest.json"), "utf8"));
	const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
	const versions = JSON.parse(readFileSync(path.join(rootDir, "versions.json"), "utf8"));

	if (manifest.id !== PLUGIN_ID)
		problems.push(`manifest.json: id is "${manifest.id}", expected "${PLUGIN_ID}"`);
	if (manifest.isDesktopOnly !== true) problems.push("manifest.json: isDesktopOnly must be true");
	if (manifest.version !== pkg.version) {
		problems.push(
			`manifest.json: version ${manifest.version} differs from package.json ${pkg.version}`,
		);
	}
	if (versions[manifest.version] !== manifest.minAppVersion) {
		problems.push(
			`versions.json: no entry mapping ${manifest.version} to ${manifest.minAppVersion}`,
		);
	}
	return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const problems = verifyArtifacts();
	for (const problem of problems) console.error(`✗ ${problem}`);
	if (problems.length === 0) console.log("✓ Build artifacts verified");
	process.exit(problems.length > 0 ? 1 : 0);
}
