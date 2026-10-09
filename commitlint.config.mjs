// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Conventional Commits with the types the engineering standard allows. Line-length limits on the
// body and footer are off: dependency update commits and release notes exceed them by design.
export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			["feat", "fix", "docs", "test", "refactor", "perf", "build", "ci", "chore", "revert"],
		],
		"body-max-line-length": [0],
		"footer-max-line-length": [0],
	},
};
