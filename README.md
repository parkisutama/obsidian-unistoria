---
title: Unistoria
created: 2026-10-01T22:20:00+07:00
modified: 2026-10-02T07:15:00+07:00
tags:
  - unistoria
  - readme
---

# Unistoria

Folder-scoped threaded conversations for Obsidian.
Every message and reply is its own Markdown file, linked to its topic and parent with portable relative Markdown links.
The vault stays the source of truth; Unistoria adds a conversation and writing interface on top.

**Status:** pre-release.
You can create a space and a topic, read it as a threaded conversation, write in Obsidian's own editor,
publish, reply, edit, and remove or restore messages.
Editing in a popout window and the final acceptance pass are still open.
See [the implementation plan](docs/implementation-plan.md) for progress.

- Desktop only, validated against Obsidian 1.14.2 and 1.14.3.
- License: GPL-3.0-only. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Versions follow Semantic Versioning and start at 0.0.1. Before 1.0.0 anything may change between releases, including the files Unistoria writes into a vault; the [changelog](CHANGELOG.md) says when it does.

## Using Unistoria

1. Run **Create space** and choose a folder; a space is an ordinary folder that holds topics.
2. Run **Create topic**, pick the space, and give the topic a title.
3. Write the first message in the editor pane and choose **Publish**. Use **Reply** on a message to answer it.

The [user guide](https://github.com/parkisutama/obsidian-univeritas/blob/main/docs/unistoria/use-unistoria.md) covers installing, threads, editing, removing and restoring messages, and compatibility with other plugins.
Everything is a Markdown file you can read, move, and edit without the plugin.

## Documentation

- [User guide](https://github.com/parkisutama/obsidian-univeritas/blob/main/docs/unistoria/use-unistoria.md) and the [guide index](https://github.com/parkisutama/obsidian-univeritas/blob/main/docs/unistoria/README.md), in the shared workspace repository
- [Development workflow](https://github.com/parkisutama/obsidian-univeritas/blob/main/docs/plugin-development-workflow.md) and [engineering standard](https://github.com/parkisutama/obsidian-univeritas/blob/main/docs/obsidian-plugin-engineering-standard.md), shared by all plugins
- [Product specification](docs/unistoria-spec.md)
- [Specification evaluation](docs/unistoria-spec-evaluation.md)
- [Implementation plan](docs/implementation-plan.md)
- [Architecture decisions](docs/decisions/README.md)
- [Contributing](CONTRIBUTING.md)
