# Developer Docs and AGENTS.md

Rework AGENTS.md and `docs/developer/` around one question: what does someone coming into this project, human or agent, need to know that the code can't tell them? That means the why, the principles, and the non-obvious constraints and gotchas. Anything that only describes what the code visibly does can go. That knowledge isn't lost: the code itself, short comments next to it, or git history cover it.

Do this last, after tasks 1–3, so the docs describe the final toolchain and component library and get rewritten once. Docs only, so this happens on `main`.

## Principles

- Keep the reasoning behind every hard-won pattern, even when the doc around it is cut. Examples:
  - why the Direct Store Pattern exists (React Hook Form + Zustand infinite loops);
  - why we never destructure from stores, and why we use `getState()`;
  - why there must be a single `@lezer/common`;
  - CSS visibility over conditional rendering;
  - the WebKit quirks;
  - the auto-save data-loss fixes;
  - the schema parsing edge cases.
- Prefer a short comment next to the code over a doc section when the knowledge is about one module.
- Don't spend effort polishing the preferences or state docs. #82 will rework the settings and project model, so capture the reasoning and leave the details.
- AGENTS.md is the entry point. It states the non-negotiable rules with a one-line reason each, and points to the docs for depth. It doesn't repeat them.

## Steps

### 1. Inventory

- [ ] Read AGENTS.md, `docs/README.md` and every file in `docs/developer/`. Write `docs/tasks-todo/temporary/docs-inventory.md` listing each piece of knowledge that isn't obvious from the code: the rule or fact, why it matters, and where it lives now
- [ ] Flag anything stale along the way: versions, removed tools, ESLint/Prettier/pnpm references, Radix-specific guidance, the line-count targets in `docs/README.md`, and the docs index in AGENTS.md
- [ ] Danny reviews the inventory before anything is cut

### 2. Decide per doc

- [ ] For each doc, decide whether to keep and rewrite around the why, merge into another doc, move its knowledge into code comments, or delete. Record the decisions in the inventory file
- [ ] Decide on `docs/archive/` (git history keeps it either way)

### 3. Rewrite

- [ ] AGENTS.md: what the project is, the non-negotiable rules with reasons, where things live, the commands, the skills, and pointers to the docs
- [ ] `docs/developer/`: rewrite according to the decisions
- [ ] `docs/README.md`: a short index and a statement of what belongs in developer docs
- [ ] `README.md` and `docs/CONTRIBUTING.md`: check the setup instructions are current
- [ ] Out of scope: `website/AGENTS.md`

### 4. Check it cold

- [ ] A fresh agent that hasn't seen the old docs reads only the new AGENTS.md and docs, and answers questions drawn from the inventory, e.g.:
  - why can't frontmatter fields use React Hook Form?
  - what breaks if two `@lezer/common` versions get installed?
  - how does auto-save avoid data loss?
  - how are nullable Zod types parsed?

  Anything it gets wrong or can't find is a gap to fix.
- [ ] Delete `docs/tasks-todo/temporary/docs-inventory.md`
