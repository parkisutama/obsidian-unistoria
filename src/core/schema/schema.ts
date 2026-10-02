// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Property schema for topic notes and message files (spec §7.5, ADR-001). Unknown properties are
// ignored here and never interpreted; preserving them is the mutation layer's job.

import { parseTimestamp } from "../identity/time";
import { parseLink } from "../links/links";

export const MESSAGE_STATUSES = ["draft", "published", "removed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const TOPIC_STATUSES = ["open", "closed"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export interface MessageProps {
	messageId: string;
	/** Raw `topic` property: a complete Markdown link. */
	topic: string;
	/** Raw `parent` property: `""` for a root message, otherwise a Markdown link. */
	parent: string;
	status: MessageStatus;
	created: string;
	updated: string;
	author: string;
	/** Epoch milliseconds of `created` read as UTC wall-clock, or null when unparsable. */
	createdMs: number | null;
	updatedMs: number | null;
}

export interface TopicProps {
	topicId: string;
	status: TopicStatus;
	created: string;
	updated: string;
	createdMs: number | null;
	updatedMs: number | null;
}

/** `problems` make the file invalid; `warnings` leave it usable but are reported. */
export type ParseResult<T> =
	| { ok: true; value: T; warnings: string[] }
	| { ok: false; problems: string[] };

type Frontmatter = Record<string, unknown>;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
	return typeof value === "string" && (list as readonly string[]).includes(value);
}

function readTime(
	fm: Frontmatter,
	key: "created" | "updated",
	problems: string[],
	warnings: string[],
): { text: string; ms: number | null } {
	const value = fm[key];
	if (value === undefined || value === null) {
		problems.push(`${key} is missing`);
		return { text: "", ms: null };
	}
	const ms = parseTimestamp(value);
	if (ms === null) warnings.push(`${key} is not a valid date and time`);
	return { text: typeof value === "string" ? value : "", ms };
}

export function parseMessageProps(fm: Frontmatter): ParseResult<MessageProps> {
	const problems: string[] = [];
	const warnings: string[] = [];

	if (fm.type !== "discussion-message") problems.push("type must be discussion-message");

	const messageId = fm.message_id;
	if (typeof messageId !== "string" || !/^msg-\S+$/.test(messageId)) {
		problems.push("message_id must look like msg-<id>");
	}

	const topic = fm.topic;
	if (topic === undefined || topic === null) problems.push("topic is missing");
	else if (!parseLink(topic).ok) problems.push("topic must be a Markdown link");

	const parent = fm.parent;
	if (parent === undefined || parent === null) problems.push("parent is missing");
	else if (typeof parent !== "string") problems.push("parent must be text");
	else if (parent !== "" && !parseLink(parent).ok)
		problems.push("parent must be empty or a Markdown link");

	if (!isOneOf(MESSAGE_STATUSES, fm.status))
		problems.push("status must be draft, published, or removed");

	const created = readTime(fm, "created", problems, warnings);
	const updated = readTime(fm, "updated", problems, warnings);

	let author = "";
	if (typeof fm.author === "string") author = fm.author;
	else if (fm.author !== undefined && fm.author !== null) warnings.push("author should be text");

	if (problems.length > 0) return { ok: false, problems };
	return {
		ok: true,
		warnings,
		value: {
			messageId: messageId as string,
			topic: topic as string,
			parent: parent as string,
			status: fm.status as MessageStatus,
			created: created.text,
			updated: updated.text,
			author,
			createdMs: created.ms,
			updatedMs: updated.ms,
		},
	};
}

export function parseTopicProps(fm: Frontmatter): ParseResult<TopicProps> {
	const problems: string[] = [];
	const warnings: string[] = [];

	if (fm.type !== "discussion-topic") problems.push("type must be discussion-topic");

	const topicId = fm.topic_id;
	if (typeof topicId !== "string" || !/^topic-\S+$/.test(topicId)) {
		problems.push("topic_id must look like topic-<id>");
	}

	if (!isOneOf(TOPIC_STATUSES, fm.status)) problems.push("status must be open or closed");

	const created = readTime(fm, "created", problems, warnings);
	const updated = readTime(fm, "updated", problems, warnings);

	if (problems.length > 0) return { ok: false, problems };
	return {
		ok: true,
		warnings,
		value: {
			topicId: topicId as string,
			status: fm.status as TopicStatus,
			created: created.text,
			updated: updated.text,
			createdMs: created.ms,
			updatedMs: updated.ms,
		},
	};
}
