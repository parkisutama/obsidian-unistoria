// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// The ordered steps that create a topic (spec §9.1, ADR-004): topic folder, Folder Note,
// `messages/` folder, first draft. The plan is data; executing it is `execute.ts`.

import { generateId, messageFileName } from "../identity/ids";
import { sanitizeTitle } from "../identity/sanitize";
import { formatTimestamp } from "../identity/time";
import { buildLink } from "../links/links";
import { messageText, topicNoteText } from "../schema/serialize";

export type PlanStep =
	| { kind: "folder"; path: string }
	| { kind: "file"; path: string; content: string };

export interface TopicPlan {
	/** The sanitized title, used as the folder name, the Folder Note name, and the link text. */
	topicName: string;
	titleChanged: boolean;
	topicId: string;
	messageId: string;
	folderPath: string;
	notePath: string;
	messagesPath: string;
	messagePath: string;
	steps: PlanStep[];
}

export interface PlanInput {
	/** Vault-relative Space folder; "" for the vault root. */
	spacePath: string;
	title: string;
	description?: string;
	now: Date;
	topicId?: string;
	messageId?: string;
}

export type PlanResult =
	| { ok: true; plan: TopicPlan }
	| { ok: false; reason: "empty" | "reserved" };

export const joinPath = (...parts: string[]) => parts.filter((p) => p !== "").join("/");

export function planTopic(input: PlanInput): PlanResult {
	const title = sanitizeTitle(input.title);
	if (!title.ok) return { ok: false, reason: title.reason };

	const space = input.spacePath.replace(/^\/+|\/+$/g, "");
	const topicId = input.topicId ?? generateId("topic");
	const messageId = input.messageId ?? generateId("msg");
	const stamp = formatTimestamp(input.now);

	const folderPath = joinPath(space, title.name);
	const notePath = joinPath(folderPath, `${title.name}.md`);
	const messagesPath = joinPath(folderPath, "messages");
	const messagePath = joinPath(messagesPath, messageFileName(input.now, messageId));

	const steps: PlanStep[] = [
		{ kind: "folder", path: folderPath },
		{
			kind: "file",
			path: notePath,
			content: topicNoteText({
				topicId,
				created: stamp,
				updated: stamp,
				description: input.description,
			}),
		},
		{ kind: "folder", path: messagesPath },
		{
			kind: "file",
			path: messagePath,
			content: messageText({
				messageId,
				topicLink: buildLink(title.name, messagePath, notePath),
				parentLink: "",
				status: "draft",
				created: stamp,
				updated: stamp,
			}),
		},
	];

	return {
		ok: true,
		plan: {
			topicName: title.name,
			titleChanged: title.changed,
			topicId,
			messageId,
			folderPath,
			notePath,
			messagesPath,
			messagePath,
			steps,
		},
	};
}
