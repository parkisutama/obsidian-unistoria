// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Parkis Utama

// The conversation view: a topic list on the left, the chosen topic's thread on the right, and a
// composer dock at the bottom. It renders what the index reports and never edits files itself;
// every change goes through the injected platform functions.

import {
	Component,
	type HoverPopover,
	ItemView,
	Keymap,
	MarkdownRenderer,
	Menu,
	Notice,
	setIcon,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { canReplyTo } from "../../core/lifecycle/lifecycle";
import { countTasks } from "../../core/markdown/tasks";
import { bodyOf } from "../../core/schema/frontmatter";
import {
	countReplies,
	formatShortTime,
	shownChildren,
	shownRoots,
} from "../../core/thread/display";
import type { ThreadNode } from "../../core/thread/thread";
import { openInTab } from "../../platform/editor/open-file";
import type { TopicIndex, TopicSnapshot } from "../../platform/index/topic-index";
import type { CreateDraftResult } from "../../platform/vault/messages";
import type { MutationResult } from "../../platform/vault/mutations";
import type { ToggleTaskResult } from "../../platform/vault/tasks";
import { openTagSearch } from "../../platform/workspace/search";
import type { UnistoriaSettings } from "../../settings/settings";
import { Composer } from "../components/Composer";
import { describeFailure } from "../messages";

export const VIEW_TYPE = "unistoria-conversation";

export interface ConversationDeps {
	index: TopicIndex;
	settings(): UnistoriaSettings;
	setStatus(
		topicFolder: string,
		path: string,
		to: "published" | "removed",
	): Promise<MutationResult>;
	setTopicStatus(
		topicFolder: string,
		notePath: string,
		to: "open" | "closed",
	): Promise<MutationResult>;
	createDraft(topicFolder: string, parentPath: string | null): Promise<CreateDraftResult>;
	toggleTask(
		topic: { folder: string; notePath: string },
		path: string,
		index: number,
		wasChecked: boolean,
	): Promise<ToggleTaskResult>;
	openCreateTopic(): void;
	openCreateSpace(): void;
}

interface ViewState {
	topic?: string;
}

const RENDER_DELAY_MS = 100;

/** Id under which Unistoria registers with Page Preview, so hover previews follow its settings. */
export const HOVER_SOURCE = "unistoria";

const TASK_BOX = "input.task-list-item-checkbox";

/** A message taller than this (in pixels) is shown as an excerpt with a "Read more" button. */
export const EXCERPT_HEIGHT_PX = 320;
/** Content only slightly over the limit is shown in full: hiding a few lines is not worth a click. */
const EXCERPT_SLACK_PX = 96;

export class ConversationView extends ItemView {
	private topicFolder: string | null = null;
	private showHidden = false;
	private topicListHidden = false;
	private readonly collapsed = new Set<string>();
	/** Messages (by path) the reader has expanded past their excerpt; kept across re-renders. */
	private readonly expandedExcerpts = new Set<string>();
	private excerptObserver: ResizeObserver | null = null;
	private readonly excerptChecks = new WeakMap<Element, () => void>();
	/** Excerpt checks waiting for the rendered content to be attached, so they can measure it. */
	private excerptQueue: Array<{ measure: () => boolean; apply: (tooTall: boolean) => void }> = [];

	private navEl!: HTMLElement;
	private mainEl!: HTMLElement;
	private scrollEl!: HTMLElement;
	private columnEl!: HTMLElement;
	private composer!: Composer;
	/** Lets Page Preview anchor its popover to this view. */
	hoverPopover: HoverPopover | null = null;
	private renderTimer: number | null = null;
	private renderSeq = 0;
	private renderChild: Component | null = null;
	private built = false;
	private liveEl!: HTMLElement;
	/** `data-focus-key` of the control that should regain focus after the next render. */
	private focusKey: string | null = null;
	/** The control that opened the composer, so focus can return to it when the composer closes. */
	private openerKey: string | null = null;
	private idSeq = 0;
	/** What the last render showed, so an index update that changes nothing visible can be skipped. */
	private lastSignature: string | null = null;
	private forceNext = true;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly deps: ConversationDeps,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE;
	}

	override getDisplayText(): string {
		const topic = this.topicFolder ? this.deps.index.topic(this.topicFolder) : undefined;
		return topic ? topic.name : "Topics";
	}

	override getIcon(): string {
		return "messages-square";
	}

	override getState(): Record<string, unknown> {
		return { topic: this.topicFolder ?? undefined };
	}

	override async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const next = (state as ViewState | null)?.topic;
		this.topicFolder = typeof next === "string" ? next : null;
		await super.setState(state, result);
		if (this.built) this.scheduleRender(0, true);
	}

	override async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("unistoria-view");
		this.navEl = root.createEl("nav", { cls: "unistoria-nav", attr: { "aria-label": "Topics" } });
		this.mainEl = root.createDiv({ cls: "unistoria-main" });
		this.scrollEl = this.mainEl.createDiv({ cls: "unistoria-scroll" });
		this.columnEl = this.scrollEl.createDiv({ cls: "unistoria-column" });
		this.wireMarkdownInteractions();
		const dock = this.mainEl.createDiv();
		this.liveEl = root.createDiv({
			cls: "unistoria-live",
			attr: { role: "status", "aria-live": "polite" },
		});
		this.composer = new Composer(this.app, dock, {
			hostLeaf: this.leaf,
			mode: () => this.deps.settings().composerMode,
			setStatus: (folder, path, to) => this.deps.setStatus(folder, path, to),
			announce: (text) => this.announce(text),
			onClosed: () => {
				this.focusKey = this.openerKey;
				this.openerKey = null;
				this.scheduleRender(0, true);
			},
		});
		this.register(this.deps.index.subscribe(() => this.scheduleRender()));
		// An editor pane the user closes by hand must not leave a composer dock pointing at nothing.
		this.registerEvent(
			this.app.workspace.on("layout-change", () => void this.composer.handleEditorGone()),
		);
		// A draft deleted or renamed while it is open must not leave a composer pointing at nothing.
		this.registerEvent(
			this.app.vault.on("delete", (file) => void this.composer.handleDeleted(file.path)),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) =>
				this.composer.handleRenamed(oldPath, file.path),
			),
		);
		this.built = true;
		this.scheduleRender(0, true);
	}

	override async onClose(): Promise<void> {
		this.built = false;
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.excerptObserver?.disconnect();
		this.excerptObserver = null;
		await this.composer?.close();
		this.renderChild?.unload();
		this.renderChild = null;
		this.contentEl.empty();
	}

	/** Shows a topic, optionally opening the composer on one of its messages. */
	async showTopic(folder: string, composePath?: string): Promise<void> {
		this.topicFolder = folder;
		this.app.workspace.requestSaveLayout();
		await this.render();
		if (composePath) await this.openComposer(composePath, "draft", "New message");
	}

	/**
	 * Index updates are unforced: they are skipped when nothing the view shows has changed, which
	 * keeps autosaving a draft in the composer from re-rendering a long thread. User actions force.
	 */
	private scheduleRender(delay = RENDER_DELAY_MS, force = false): void {
		if (!this.built) return;
		if (force) this.forceNext = true;
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			void this.render();
		}, delay);
	}

	/** Tells screen readers about a change that has no other visible or focusable result. */
	private announce(text: string): void {
		if (!this.built) return;
		this.liveEl.setText("");
		window.setTimeout(() => this.liveEl.setText(text), 50);
	}

	/** Marks a control so focus can be restored after the view re-renders. */
	private focusable<T extends HTMLElement>(el: T, key: string): T {
		el.setAttribute("data-focus-key", key);
		return el;
	}

	private currentFocusKey(): string | null {
		const active = this.contentEl.ownerDocument.activeElement;
		if (!(active instanceof HTMLElement) || !this.mainEl.contains(active)) {
			return active instanceof HTMLElement && this.navEl.contains(active)
				? active.getAttribute("data-focus-key")
				: null;
		}
		return this.scrollEl.contains(active) ? active.getAttribute("data-focus-key") : null;
	}

	private restoreFocus(): void {
		const key = this.focusKey;
		this.focusKey = null;
		if (key === null) return;
		const target = [...this.contentEl.querySelectorAll<HTMLElement>("[data-focus-key]")].find(
			(el) => el.getAttribute("data-focus-key") === key,
		);
		target?.focus({ preventScroll: true });
	}

	private signature(): string {
		const { index } = this.deps;
		const mtime = (path: string) => this.app.vault.getFileByPath(path)?.stat.mtime ?? 0;
		const parts: string[] = [
			this.topicFolder ?? "",
			String(this.showHidden),
			[...this.collapsed].sort().join("|"),
		];
		for (const topic of index.topics()) {
			parts.push(
				`${topic.folderPath}:${topic.props?.status ?? "invalid"}:${topic.problems.length}`,
			);
		}
		const topic = this.topicFolder ? index.topic(this.topicFolder) : undefined;
		if (topic) {
			parts.push(
				`note:${mtime(topic.notePath)}`,
				`issues:${topic.issues.length}:${topic.problems.join(",")}`,
				`vault-issues:${index.vaultIssues().length}`,
			);
			const walk = (node: ThreadNode) => {
				parts.push(
					`${node.path}|${node.props.status}|${node.props.updated}|${mtime(node.path)}|${node.hiddenReason}`,
				);
				for (const child of shownChildren(node, this.showHidden)) walk(child);
			};
			for (const root of shownRoots(topic.thread, this.showHidden)) walk(root);
			// Drafts are listed without their text, so editing one does not change what is shown.
			for (const draft of topic.thread.drafts)
				parts.push(`draft:${draft.path}:${draft.props.created}`);
		}
		return parts.join("\n");
	}

	private async render(): Promise<void> {
		if (!this.built) return;
		const signature = this.signature();
		if (!this.forceNext && signature === this.lastSignature) return;
		this.forceNext = false;
		this.lastSignature = signature;
		const seq = ++this.renderSeq;
		const scrollTop = this.scrollEl.scrollTop;
		this.focusKey = this.focusKey ?? this.currentFocusKey();

		this.excerptObserver?.disconnect();
		this.excerptQueue = [];
		// The observer class of the window that shows the view (a popout has its own).
		const Observer =
			(this.contentEl.win as unknown as { ResizeObserver?: typeof ResizeObserver })
				.ResizeObserver ?? ResizeObserver;
		this.excerptObserver = new Observer((entries) => {
			for (const entry of entries) this.excerptChecks.get(entry.target)?.();
		});

		this.renderChild?.unload();
		const child = new Component();
		child.load();
		this.renderChild = child;

		this.contentEl.toggleClass("is-nav-hidden", this.topicListHidden);
		this.renderNav();

		const topic = this.topicFolder ? this.deps.index.topic(this.topicFolder) : undefined;
		const fragment = document.createDocumentFragment();
		const holder = createDiv();
		fragment.appendChild(holder);
		if (!topic) this.renderEmpty(holder);
		else await this.renderTopic(holder, topic, child, seq);

		if (seq !== this.renderSeq || !this.built) return;
		this.columnEl.empty();
		while (holder.firstChild) this.columnEl.appendChild(holder.firstChild);
		// Measure now that the content is attached; the observer takes over for later changes.
		// All reads first, then all writes, so the browser lays out once instead of once per message.
		const queued = this.excerptQueue.splice(0);
		const measured = queued.map((entry) => entry.measure());
		for (const [i, entry] of queued.entries()) entry.apply(measured[i] ?? false);
		this.scrollEl.scrollTop = scrollTop;
		this.restoreFocus();
		(this.leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
	}

	// --- navigation ---------------------------------------------------------------------------

	private renderNav(): void {
		const nav = this.navEl;
		nav.empty();
		const bar = nav.createDiv({ cls: "unistoria-nav-bar" });
		const newTopic = this.focusable(
			bar.createEl("button", { text: "New topic", cls: "mod-cta" }),
			"new-topic",
		);
		newTopic.addEventListener("click", () => this.deps.openCreateTopic());
		const newSpace = this.focusable(bar.createEl("button", { text: "New space" }), "new-space");
		newSpace.addEventListener("click", () => this.deps.openCreateSpace());

		const topics = this.deps.index.topics();
		if (topics.length === 0) {
			nav.createEl("p", { cls: "unistoria-muted", text: "No topics yet." });
			return;
		}
		let currentSpace: string | null = null;
		let list: HTMLElement | null = null;
		for (const topic of topics) {
			if (topic.spacePath !== currentSpace) {
				currentSpace = topic.spacePath;
				const heading = nav.createEl("div", {
					cls: "unistoria-space-name",
					text: currentSpace || "(vault root)",
					attr: { id: `unistoria-space-${this.idSeq++}` },
				});
				list = nav.createEl("ul", {
					cls: "unistoria-topic-list",
					attr: { "aria-labelledby": heading.id },
				});
			}
			const item = (list as HTMLElement).createEl("li");
			const button = this.focusable(
				item.createEl("button", {
					cls: "unistoria-topic-item",
					attr: { "aria-current": String(topic.folderPath === this.topicFolder) },
				}),
				`topic:${topic.folderPath}`,
			);
			button.createSpan({
				cls: `unistoria-state is-${topic.props?.status ?? "invalid"}`,
				text: topic.props?.status === "closed" ? "Closed" : topic.props ? "Open" : "Invalid",
			});
			button.createSpan({ cls: "unistoria-topic-name", text: topic.name });
			button.addEventListener("click", () => {
				this.topicFolder = topic.folderPath;
				this.app.workspace.requestSaveLayout();
				void this.composer.close();
				this.scheduleRender(0, true);
			});
		}
	}

	/** A labelled button that shows or hides the topic list; present in every state of the pane. */
	private renderTopicListToggle(host: HTMLElement): void {
		const toggle = this.focusable(
			host.createEl("button", {
				cls: "unistoria-list-toggle",
				attr: {
					"aria-label": "Show or hide the topic list",
					"aria-expanded": String(!this.topicListHidden),
				},
			}),
			"list-toggle",
		);
		setIcon(toggle.createSpan({ cls: "unistoria-list-toggle-icon" }), "panel-left");
		toggle.createSpan({ text: "Topics" });
		toggle.addEventListener("click", () => {
			this.topicListHidden = !this.topicListHidden;
			toggle.setAttribute("aria-expanded", String(!this.topicListHidden));
			this.contentEl.toggleClass("is-nav-hidden", this.topicListHidden);
			this.announce(this.topicListHidden ? "Topic list hidden" : "Topic list shown");
		});
	}

	private renderEmpty(host: HTMLElement): void {
		this.renderTopicListToggle(host);
		const box = host.createDiv({ cls: "unistoria-empty" });
		box.createEl("h3", {
			text: this.topicFolder ? "This topic no longer exists" : "Choose a topic",
		});
		box.createEl("p", {
			text: "Create a space, then a topic. Each message is stored as its own Markdown file.",
		});
	}

	// --- topic ---------------------------------------------------------------------------------

	private async renderTopic(
		host: HTMLElement,
		topic: TopicSnapshot,
		component: Component,
		seq: number,
	): Promise<void> {
		const header = host.createDiv({ cls: "unistoria-topic-header" });
		this.renderTopicListToggle(header);
		header.createEl("h2", { text: topic.name });

		const tools = header.createDiv({ cls: "unistoria-topic-tools" });
		if (topic.props) {
			const status = topic.props.status;
			const toggle = this.focusable(
				tools.createEl("button", { text: status === "open" ? "Close topic" : "Reopen topic" }),
				"topic-status",
			);
			toggle.addEventListener("click", async () => {
				const result = await this.deps.setTopicStatus(
					topic.folderPath,
					topic.notePath,
					status === "open" ? "closed" : "open",
				);
				if (!result.ok) new Notice(describeFailure(result));
				else this.announce(status === "open" ? "Topic closed" : "Topic reopened");
			});
		}
		const noteButton = this.focusable(
			tools.createEl("button", { text: "Edit context" }),
			"context",
		);
		noteButton.addEventListener("click", () => void this.openFile(topic.notePath));
		const revealLabel = tools.createEl("label", { cls: "unistoria-reveal" });
		const revealBox = this.focusable(revealLabel.createEl("input", { type: "checkbox" }), "reveal");
		revealBox.checked = this.showHidden;
		revealLabel.appendText(" Show removed and unpublished");
		revealBox.addEventListener("change", () => {
			this.showHidden = revealBox.checked;
			this.scheduleRender(0, true);
		});

		if (topic.props?.status === "closed") {
			host.createDiv({
				cls: "unistoria-closed-note",
				text: "This topic is closed. You can still reply.",
			});
		}

		await this.renderContext(host, topic, component);
		this.renderIntegrity(host, topic);

		const thread = host.createEl("ul", {
			cls: "unistoria-thread",
			attr: { "aria-label": "Conversation" },
		});
		const roots = shownRoots(topic.thread, this.showHidden);
		if (roots.length === 0) {
			const empty = host.createDiv({ cls: "unistoria-empty" });
			empty.createEl("p", { text: "No published messages yet." });
			const start = this.focusable(
				empty.createEl("button", { text: "Start the first message", cls: "mod-cta" }),
				"start",
			);
			start.addEventListener("click", () => void this.newMessage(topic, null));
		}
		for (const root of roots) {
			if (seq !== this.renderSeq) return;
			await this.renderNode(thread, root, topic, component, seq);
		}

		if (roots.length > 0) {
			const add = host.createDiv({ cls: "unistoria-add" });
			const button = this.focusable(add.createEl("button", { text: "New message" }), "add");
			button.addEventListener("click", () => void this.newMessage(topic, null));
		}
		this.renderDrafts(host, topic);
	}

	private async renderContext(
		host: HTMLElement,
		topic: TopicSnapshot,
		component: Component,
	): Promise<void> {
		const file = this.app.vault.getFileByPath(topic.notePath);
		if (!file) return;
		const source = await this.app.vault.cachedRead(file);
		const body = bodyOf(source).trim();
		if (body === "") return;
		const context = host.createDiv({ cls: "unistoria-topic-context" });
		const inner = context.createDiv({ cls: "unistoria-message-content" });
		await this.renderMarkdown(inner, body, topic.notePath, component, source);
		this.makeExcerpt(context, inner, topic.notePath, `the context of ${topic.name}`);
	}

	/**
	 * Long text is shown as an excerpt with a "Read more" button. The height is measured, not the
	 * character count, because Markdown (lists, callouts, images, code) varies widely in height.
	 * `inner` holds the content and is observed, so late-loading images and embeds are accounted for;
	 * `outer` is clamped. The reader's choice survives re-renders.
	 */
	private makeExcerpt(outer: HTMLElement, inner: HTMLElement, key: string, label: string): void {
		const button = createEl("button", {
			cls: "unistoria-read-more",
			attr: { "data-focus-key": `excerpt:${key}` },
		});
		const bodyId = `unistoria-excerpt-${this.idSeq++}`;
		outer.id = bodyId;
		button.setAttribute("aria-controls", bodyId);
		button.hide();
		outer.after(button);

		const measure = () => inner.scrollHeight > EXCERPT_HEIGHT_PX + EXCERPT_SLACK_PX;
		const apply = (tooTall: boolean) => {
			if (!tooTall) {
				outer.removeClass("is-clamped");
				button.hide();
				return;
			}
			const open = this.expandedExcerpts.has(key);
			outer.toggleClass("is-clamped", !open);
			button.show();
			button.setText(open ? "Show less" : "Read more");
			button.setAttribute("aria-expanded", String(open));
			button.setAttribute("aria-label", `${open ? "Show less of" : "Read more of"} ${label}`);
		};
		const evaluate = () => apply(measure());
		button.addEventListener("click", () => {
			if (this.expandedExcerpts.has(key)) this.expandedExcerpts.delete(key);
			else this.expandedExcerpts.add(key);
			evaluate();
			this.announce(this.expandedExcerpts.has(key) ? "Message expanded" : "Message shortened");
		});
		this.excerptChecks.set(inner, evaluate);
		this.excerptQueue.push({ measure, apply });
		this.excerptObserver?.observe(inner);
	}

	/**
	 * Renders a message or topic body with Obsidian's own renderer, so callouts, quotes, embeds, math,
	 * code, and the rest behave as in reading view, and makes the result interactive: internal links
	 * open, hovering previews, tags search, and task checkboxes toggle (see wireMarkdownInteractions).
	 */
	private async renderMarkdown(
		host: HTMLElement,
		text: string,
		sourcePath: string,
		component: Component,
		fileText: string,
	): Promise<void> {
		host.addClass("markdown-rendered", "unistoria-markdown");
		host.setAttribute("data-source-path", sourcePath);
		await MarkdownRenderer.render(this.app, text, host, sourcePath, component);
		// Checkboxes map to source lines by order. If the rendered count differs from the source
		// (for example an embedded note that has its own tasks), leave them read-only.
		const boxes = [...host.querySelectorAll<HTMLInputElement>(TASK_BOX)];
		const interactive = boxes.length > 0 && boxes.length === countTasks(fileText);
		for (const box of boxes) {
			box.disabled = !interactive;
			if (!interactive) box.setAttribute("title", "Edit the message to change this checkbox");
		}
	}

	/** One set of delegated listeners for everything rendered inside the thread. */
	private wireMarkdownInteractions(): void {
		const sourceOf = (el: Element) =>
			el.closest<HTMLElement>("[data-source-path]")?.getAttribute("data-source-path") ?? "";

		this.registerDomEvent(this.scrollEl, "click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;

			const link = target.closest<HTMLAnchorElement>("a.internal-link");
			if (link) {
				event.preventDefault();
				const href = link.getAttribute("data-href") ?? link.getAttribute("href") ?? "";
				void this.app.workspace.openLinkText(href, sourceOf(link), Keymap.isModEvent(event));
				return;
			}
			const tag = target.closest<HTMLAnchorElement>("a.tag");
			if (tag) {
				event.preventDefault();
				openTagSearch(this.app, tag.getAttribute("href") ?? tag.textContent ?? "");
				return;
			}
			const box = target.closest<HTMLInputElement>(TASK_BOX);
			if (box && !box.disabled) void this.toggleCheckbox(box, sourceOf(box));
		});

		this.registerDomEvent(this.scrollEl, "mouseover", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const link = target.closest<HTMLAnchorElement>("a.internal-link");
			if (!link) return;
			this.app.workspace.trigger("hover-link", {
				event,
				source: HOVER_SOURCE,
				hoverParent: this,
				targetEl: link,
				linktext: link.getAttribute("data-href") ?? link.getAttribute("href") ?? "",
				sourcePath: sourceOf(link),
			});
		});
	}

	private async toggleCheckbox(box: HTMLInputElement, path: string): Promise<void> {
		const topic = this.topicFolder ? this.deps.index.topic(this.topicFolder) : undefined;
		if (!topic || path === "") return;
		const host = box.closest<HTMLElement>("[data-source-path]");
		const index = host ? [...host.querySelectorAll(TASK_BOX)].indexOf(box) : -1;
		// The browser has already flipped the box; the state the reader acted on is the opposite.
		const wasChecked = !box.checked;
		const result = await this.deps.toggleTask(
			{ folder: topic.folderPath, notePath: topic.notePath },
			path,
			index,
			wasChecked,
		);
		if (!result.ok) {
			box.checked = wasChecked;
			new Notice(
				result.reason === "changed"
					? "That checkbox changed in the file. Review it and try again."
					: "The checkbox could not be changed.",
			);
		}
	}

	private renderIntegrity(host: HTMLElement, topic: TopicSnapshot): void {
		const issues = [
			...topic.issues,
			...this.deps.index.vaultIssues().filter((i) => i.path.startsWith(`${topic.folderPath}/`)),
		];
		const problems =
			topic.problems.length > 0
				? [`The Folder Note has invalid properties: ${topic.problems.join("; ")}`]
				: [];
		if (issues.length === 0 && problems.length === 0) return;
		const details = host.createEl("details", { cls: "unistoria-integrity" });
		details.createEl("summary", {
			text: `${issues.length + problems.length} data problem${issues.length + problems.length === 1 ? "" : "s"} in this topic`,
		});
		const list = details.createEl("ul");
		for (const text of problems) list.createEl("li", { text });
		for (const issue of issues) {
			const item = list.createEl("li");
			item.createSpan({ text: `${describeIssue(issue.kind)}: ${issue.detail} ` });
			const open = item.createEl("a", { text: "Open file", href: "#" });
			open.addEventListener("click", (event) => {
				event.preventDefault();
				void this.openFile(issue.path);
			});
		}
	}

	private renderDrafts(host: HTMLElement, topic: TopicSnapshot): void {
		const drafts = topic.thread.drafts;
		if (drafts.length === 0) return;
		const section = host.createEl("section", { cls: "unistoria-drafts" });
		section.createEl("h3", { text: `Drafts (${drafts.length})` });
		section.createEl("p", {
			cls: "unistoria-muted",
			text: "Unpublished messages. They are not private: anyone with access to this vault can open them.",
		});
		const list = section.createEl("ul");
		for (const draft of drafts) {
			const item = list.createEl("li");
			item.createSpan({ text: `${formatShortTime(draft.props.created)} ` });
			item.createSpan({
				cls: "unistoria-muted",
				text: draft.props.parent === "" ? "(new message)" : "(reply)",
			});
			const open = this.focusable(
				item.createEl("button", {
					text: "Open",
					attr: { "aria-label": `Open the draft from ${formatShortTime(draft.props.created)}` },
				}),
				`draft:${draft.path}`,
			);
			open.addEventListener("click", () => void this.openComposer(draft.path, "draft", "Draft"));
		}
	}

	// --- messages ------------------------------------------------------------------------------

	private async renderNode(
		parentEl: HTMLElement,
		node: ThreadNode,
		topic: TopicSnapshot,
		component: Component,
		seq: number,
	): Promise<void> {
		const replies = countReplies(node, this.showHidden);
		const isCollapsed = this.collapsed.has(node.path);
		const item = parentEl.createEl("li", { cls: "unistoria-node" });
		const who = node.props.author !== "" ? node.props.author : "unknown author";
		const label = `Message from ${who}, ${formatShortTime(node.props.created)}`;
		const card = item.createEl("article", {
			cls: "unistoria-message",
			attr: { "data-path": node.path, "aria-label": label },
		});
		if (node.hiddenReason) card.addClass(`is-${node.hiddenReason}`);

		const head = card.createDiv({ cls: "unistoria-message-head" });
		if (node.props.author !== "")
			head.createSpan({ cls: "unistoria-author", text: node.props.author });
		head.createSpan({ cls: "unistoria-time", text: formatShortTime(node.props.created) });
		if (node.hiddenReason === "orphan")
			head.createSpan({ cls: "unistoria-badge", text: "Detached" });
		else if (node.props.status !== "published") {
			head.createSpan({
				cls: "unistoria-badge",
				text: node.props.status === "draft" ? "Unpublished draft" : "Removed",
			});
		}

		const body = card.createDiv({ cls: "unistoria-message-body" });
		const content = body.createDiv({ cls: "unistoria-message-content" });
		const file = this.app.vault.getFileByPath(node.path);
		if (file) {
			const source = await this.app.vault.cachedRead(file);
			const text = bodyOf(source).trim();
			if (seq !== this.renderSeq) return;
			if (text === "") content.createEl("em", { cls: "unistoria-muted", text: "(empty)" });
			else await this.renderMarkdown(content, text, node.path, component, source);
		}
		this.makeExcerpt(body, content, node.path, label.toLowerCase());

		this.renderActions(card, node, topic, replies, isCollapsed, label);

		if (replies > 0 && !isCollapsed) {
			const children = item.createEl("ul", {
				cls: "unistoria-children",
				attr: { id: this.repliesId(node.path), "aria-label": `Replies to ${label}` },
			});
			for (const child of shownChildren(node, this.showHidden)) {
				if (seq !== this.renderSeq) return;
				await this.renderNode(children, child, topic, component, seq);
			}
		}
	}

	private renderActions(
		card: HTMLElement,
		node: ThreadNode,
		topic: TopicSnapshot,
		replies: number,
		isCollapsed: boolean,
		label: string,
	): void {
		const actions = card.createDiv({ cls: "unistoria-message-actions" });
		const status = node.props.status;

		if (canReplyTo(status) && node.hiddenReason !== "orphan") {
			const reply = this.focusable(
				actions.createEl("button", { text: "Reply", attr: { "aria-label": `Reply to ${label}` } }),
				`reply:${node.path}`,
			);
			reply.addEventListener("click", () => void this.newMessage(topic, node));
		}
		if (status === "published" || status === "draft") {
			const edit = this.focusable(
				actions.createEl("button", {
					text: status === "draft" ? "Open draft" : "Edit",
					attr: { "aria-label": `${status === "draft" ? "Open draft of" : "Edit"} ${label}` },
				}),
				`edit:${node.path}`,
			);
			edit.addEventListener(
				"click",
				() =>
					void this.openComposer(
						node.path,
						status === "draft" ? "draft" : "edit",
						status === "draft" ? "Draft" : "Edit message",
					),
			);
		}
		if (replies > 0) {
			const word = replies === 1 ? "reply" : "replies";
			const toggle = this.focusable(
				actions.createEl("button", {
					cls: "unistoria-thread-toggle",
					text: `${isCollapsed ? "Show" : "Hide"} ${replies} ${word}`,
					attr: { "aria-expanded": String(!isCollapsed) },
				}),
				`thread:${node.path}`,
			);
			if (!isCollapsed) toggle.setAttribute("aria-controls", this.repliesId(node.path));
			toggle.addEventListener("click", () => {
				if (this.collapsed.has(node.path)) this.collapsed.delete(node.path);
				else this.collapsed.add(node.path);
				this.announce(`${replies} ${word} ${this.collapsed.has(node.path) ? "hidden" : "shown"}`);
				this.scheduleRender(0, true);
			});
		}

		const more = this.focusable(
			actions.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": `More actions for ${label}`, "aria-haspopup": "menu" },
			}),
			`more:${node.path}`,
		);
		setIcon(more, "more-horizontal");
		more.addEventListener("click", (event) => {
			const menu = new Menu();
			if (status === "published") {
				menu.addItem((i) =>
					i
						.setTitle("Remove")
						.setIcon("trash")
						.onClick(() => void this.changeStatus(topic, node, "removed")),
				);
			}
			if (status === "removed") {
				menu.addItem((i) =>
					i
						.setTitle("Restore and publish")
						.setIcon("undo")
						.onClick(() => void this.changeStatus(topic, node, "published")),
				);
			}
			menu.addItem((i) =>
				i
					.setTitle("Open file")
					.setIcon("file-text")
					.onClick(() => void this.openFile(node.path)),
			);
			menu.showAtMouseEvent(event);
		});
	}

	// --- actions -------------------------------------------------------------------------------

	private async changeStatus(
		topic: TopicSnapshot,
		node: ThreadNode,
		to: "published" | "removed",
	): Promise<void> {
		const result = await this.deps.setStatus(topic.folderPath, node.path, to);
		if (!result.ok) new Notice(describeFailure(result));
		else this.announce(to === "removed" ? "Message removed" : "Message restored and published");
	}

	private async newMessage(topic: TopicSnapshot, parent: ThreadNode | null): Promise<void> {
		const created = await this.deps.createDraft(topic.folderPath, parent ? parent.path : null);
		if (!created.ok) {
			new Notice(`Could not create the draft: ${created.error}`);
			return;
		}
		await this.deps.index.update([created.path]);
		await this.openComposer(
			created.path,
			parent ? "reply" : "draft",
			parent ? `Reply to the message from ${formatShortTime(parent.props.created)}` : "New message",
		);
	}

	private repliesId(path: string): string {
		let hash = 0;
		for (const char of path) hash = (hash * 31 + char.charCodeAt(0)) | 0;
		return `unistoria-replies-${(hash >>> 0).toString(36)}`;
	}

	private async openComposer(
		path: string,
		kind: "draft" | "reply" | "edit",
		title: string,
	): Promise<void> {
		if (!this.topicFolder) return;
		this.openerKey = this.currentFocusKey() ?? this.openerKey;
		await this.composer.open({ path, topicFolder: this.topicFolder, kind, title });
	}

	private async openFile(path: string): Promise<void> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			new Notice("That file no longer exists.");
			return;
		}
		await openInTab(this.app, file);
	}
}

const ISSUE_LABELS: Record<string, string> = {
	"invalid-file": "Invalid message file",
	"invalid-timestamp": "Unreadable date",
	"duplicate-id": "Duplicate id",
	"invalid-link": "Unusable parent link",
	"missing-parent": "Missing parent",
	"parent-outside-topic": "Parent outside this topic",
	"parent-invalid": "Parent is an invalid file",
	"self-parent": "Message is its own parent",
	cycle: "Parent loop",
	"topic-link-broken": "Broken topic link",
	"topic-note-renamed": "Folder Note renamed",
	"duplicate-topic-note": "Second Folder Note",
};

function describeIssue(kind: string): string {
	return ISSUE_LABELS[kind] ?? kind;
}
