# AGENTS.md — working on the Manifast codebase

You're in the **source repo of the Manifast tool**. For how to work on this
codebase (architecture, commands, conventions, hard constraints, gotchas,
release process), read **[`CLAUDE.md`](./CLAUDE.md)** — it's the canonical guide
for Claude, Codex, and any other agent.

Quick start:

```bash
npm install
npm run dev        # Vite :5173 (HMR) + API/WS server :4317
npm run build && npm run typecheck && npm run check
```

> Don't confuse this with the **end-user authoring guide** (how to write
> `.manifast/` wireframe & doc files). That's a *template* at
> [`skill/AGENTS.md`](./skill/AGENTS.md) / [`skill/SKILL.md`](./skill/SKILL.md),
> which `manifast init` installs into projects that *use* Manifast.
