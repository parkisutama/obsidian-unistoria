// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// License notice prepended to the distributed plugin files.
// Notices for adapted code live in THIRD_PARTY_NOTICES.md; keep both in sync.

export const PROJECT_LICENSE = "GPL-3.0-only";
export const REPOSITORY_URL = "https://github.com/parkisutama/obsidian-unistoria";
export const PROJECT_COPYRIGHT = "Copyright (C) 2026 Parkis Utama";
export const BANNER_START = "/*! Unistoria";

/** Build the preserved (`/*!`) license banner for a distributed file. */
export function buildLicenseBanner(version) {
	return [
		`${BANNER_START} v${version} | SPDX-License-Identifier: ${PROJECT_LICENSE}`,
		` * ${PROJECT_COPYRIGHT}`,
		` * Source: ${REPOSITORY_URL}`,
		` * Third-party notices: ${REPOSITORY_URL}/blob/main/THIRD_PARTY_NOTICES.md`,
		" */",
	].join("\n");
}

/** Text every licensed artifact must contain near its start. */
export function requiredNoticeFragments() {
	return [BANNER_START, `SPDX-License-Identifier: ${PROJECT_LICENSE}`, PROJECT_COPYRIGHT];
}
