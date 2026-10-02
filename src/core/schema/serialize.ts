// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// Text of the files the plugin creates (spec §7.2, §7.3). Only generated files are serialized here;
// existing files are changed through Obsidian's frontmatter API (ADR-005).

/** A double-quoted YAML string. */
export function yamlQuote(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface TopicNoteInput {
	topicId: string;
	created: string;
	updated: string;
	description?: string;
}

export function topicNoteText(input: TopicNoteInput): string {
	const lines = [
		"---",
		"type: discussion-topic",
		`topic_id: ${input.topicId}`,
		"status: open",
		`created: ${input.created}`,
		`updated: ${input.updated}`,
		"---",
	];
	const description = input.description?.trim();
	return description ? `${lines.join("\n")}\n\n${description}\n` : `${lines.join("\n")}\n`;
}

export interface MessageInput {
	messageId: string;
	/** Complete Markdown link to the Folder Note. */
	topicLink: string;
	/** Complete Markdown link to the parent message, or "" for a root message. */
	parentLink: string;
	status: "draft" | "published" | "removed";
	created: string;
	updated: string;
	author?: string;
	body?: string;
}

export function messageText(input: MessageInput): string {
	const lines = [
		"---",
		"type: discussion-message",
		`message_id: ${input.messageId}`,
		`topic: ${yamlQuote(input.topicLink)}`,
		`parent: ${yamlQuote(input.parentLink)}`,
		`status: ${input.status}`,
		`created: ${input.created}`,
		`updated: ${input.updated}`,
		`author: ${yamlQuote(input.author ?? "")}`,
		"---",
	];
	return `${lines.join("\n")}\n\n${input.body ?? ""}`;
}
