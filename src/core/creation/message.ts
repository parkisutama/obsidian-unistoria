// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// A new draft message inside an existing topic: a reply (with a parent) or a root message.
// The file is created as a draft; publishing is a separate, explicit status change.

import { generateId, messageFileName } from "../identity/ids";
import { formatTimestamp } from "../identity/time";
import { buildLink } from "../links/links";
import { messageText } from "../schema/serialize";
import { messagesFolderOf } from "../thread/boundary";
import { joinPath } from "./plan";

export interface MessageInput {
	topicFolder: string;
	/** The topic's Folder Note. */
	notePath: string;
	/** Path of the parent message, or null for a root message. */
	parentPath: string | null;
	now: Date;
	author?: string;
	messageId?: string;
}

export interface MessagePlan {
	messageId: string;
	path: string;
	content: string;
}

const PARENT_LABEL = "Parent message";

export function planMessage(input: MessageInput): MessagePlan {
	const messageId = input.messageId ?? generateId("msg");
	const path = joinPath(messagesFolderOf(input.topicFolder), messageFileName(input.now, messageId));
	const noteName = (input.notePath.split("/").pop() ?? input.notePath).replace(/\.md$/i, "");
	const stamp = formatTimestamp(input.now);
	return {
		messageId,
		path,
		content: messageText({
			messageId,
			topicLink: buildLink(noteName, path, input.notePath),
			parentLink: input.parentPath === null ? "" : buildLink(PARENT_LABEL, path, input.parentPath),
			status: "draft",
			created: stamp,
			updated: stamp,
			author: input.author,
		}),
	};
}
