# Documentation

## Developer docs

`docs/developer/` is reference for anyone working on the codebase, human or AI agent. Start with `AGENTS.md` at the repo root, which states the rules and lists every developer doc, then `developer/architecture-guide.md`.

### What belongs in them

A developer doc holds what someone new to the project needs to know and can't get from the code: why things are built the way they are, the principles behind them, constraints, and gotchas that cost time to discover. It doesn't describe what the code visibly does, list files or interfaces, or repeat general advice about the libraries we use.

- **Knowledge about one module** goes in a short comment next to that code, not in a doc.
- **One place per fact.** AGENTS.md states each rule in one line with its reason; the docs explain it once, in the doc for that area.
- **Keep it current.** When a change invalidates a doc, update the doc in the same change.
- **Flat folder,** named by topic, so the right doc is easy to find.

## Other docs

- **[CONTRIBUTING.md](CONTRIBUTING.md):** setting up and contributing.
- **[SECURITY.md](SECURITY.md):** the security policy.
- **User documentation** is on the [documentation site](https://astroeditor.danny.is/getting-started/), built from `website/`.

## Tasks

- **[tasks-todo/](tasks-todo/):** the backlog. Naming and the done-renaming rule are in `AGENTS.md`.
- **[tasks-done/](tasks-done/):** completed tasks. A record of what was done and why at the time, so often out of date.

## Archive

**[archive/](archive/)** holds the original requirements notes, kept for historical interest only.
