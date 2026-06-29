# Manifast

**A local, read-only visualizer for AI-authored wireframes and dev docs.**

![Manifast — AI writes files, Manifast visualizes them locally](https://raw.githubusercontent.com/guinnessNet/manifast/main/docs/screenshots/manifast-overview.png)

> v1.2.2 · version history in [CHANGELOG.md](https://github.com/guinnessNet/manifast/blob/main/CHANGELOG.md) · working on Manifast's own code? see [CLAUDE.md](https://github.com/guinnessNet/manifast/blob/main/CLAUDE.md)

**How it works:** an AI coding agent ([Claude Code](https://www.claude.com/product/claude-code)
or [Codex](https://developers.openai.com/codex/cli/)) writes structured files into a
`.manifast/` folder → Manifast renders them as live views in your browser → edit (or let
the agent edit) and the view live-reloads. **The agent authors; the app only
visualizes — it never calls an AI itself.** You need one of those agents to author
content, but Manifast itself is just a local viewer.

Claude Code / Codex write structured files into a `.manifast/` folder (wireframe
JSON, PRD/spec Markdown, task/plan JSON, and diagram JSON). Manifast renders them
as a live **wireframe canvas**, **doc viewer**, **kanban board**, **roadmap**,
**relationship map**, **user-flow view**, and **feature-tree view** — with
**live reload** when the agent edits a file, **light/dark themes** + accent
colors, and **export** to PNG/SVG/HTML/JSON/Markdown/ZIP. Fully local, personal,
no accounts, no database, no AI calls.

The app never writes your files, with two scoped exceptions: `manifast init`
(scaffolds the workspace and refreshes Manifast-managed skill files without
overwriting your own content) and the
[Document management](#document-management-v2) feature, which writes **only doc
frontmatter** (`uid` + status/metadata, never the body). The single source of
truth is the `.manifast/` folder; the server just reads, validates, and serves it.

## Screenshots

![Wireframe canvas](https://raw.githubusercontent.com/guinnessNet/manifast/main/docs/screenshots/wireframes.png)

| Docs | Tasks |
|---|---|
| ![Docs](https://raw.githubusercontent.com/guinnessNet/manifast/main/docs/screenshots/docs.png) | ![Tasks board](https://raw.githubusercontent.com/guinnessNet/manifast/main/docs/screenshots/tasks.png) |
| **Plan** | **Map** |
| ![Roadmap](https://raw.githubusercontent.com/guinnessNet/manifast/main/docs/screenshots/plan.png) | ![Relationship map](https://raw.githubusercontent.com/guinnessNet/manifast/main/docs/screenshots/map.png) |

---

## Requirements

- Node.js **≥ 20** (developed/tested on Node 22)
- No API keys, no network — everything runs on `localhost`.

## Install

Install the CLI globally from npm:

```bash
npm install -g manifast   # put the `manifast` command on your PATH
manifast --version
```

Or run it without installing:

```bash
npx manifast
```

> **Building from source?** See [CLAUDE.md](https://github.com/guinnessNet/manifast/blob/main/CLAUDE.md) — clone, `npm install`,
> `npm run build`, then `npm install -g .` (bump `version` first; the **same**
> version reports "up to date" and won't refresh).

## Quick start

> **Prerequisite:** to *author* content you need an AI coding agent installed —
> [Claude Code](https://www.claude.com/product/claude-code) or
> [Codex](https://developers.openai.com/codex/cli/). Manifast doesn't write content
> for you; it visualizes what the agent writes. (Just want to look around first?
> Skip to the demo below — no agent required.)

```bash
# 1) In your project, scaffold .manifast/ and install the agent guide
manifast init

# 2) In the SAME folder, open your agent (Claude Code or Codex) and ask, e.g.
#    "Design a login + dashboard screen and write the PRD."
#    The agent auto-reads .manifast/AGENTS.md (Claude Code also loads the
#    .claude/skills/manifast skill) and writes valid files into .manifast/.
#    You don't copy anything in — the guide loads itself.

# 3) Start the viewer (opens your browser at http://localhost:4317)
manifast
```

Edit any `.manifast/` file (or let the agent edit it) and the matching view
refreshes in ~300 ms — no full page reload.

**Just want to see it first?** Until an agent writes files, the views are empty —
that's expected, not a bug. Load a sample workspace to explore every view right
away (no agent needed):

```bash
manifast init --example   # seed a demo .manifast/ (never overwrites your files)
manifast                  # explore the wireframe, docs, tasks, plan & diagram views
manifast init --rm-example  # later: remove the demo (keeps anything you changed)
```

## CLI

| Command | Action |
|---|---|
| `manifast` | Start the server for the current folder and open the browser |
| `manifast <dir>` | Use `<dir>` (or `<dir>/.manifast`) as the workspace |
| `manifast init [dir]` | Scaffold `.manifast/` + install/refresh Manifast-managed agent guides without overwriting user content |
| `manifast init --example` | Also seed a demo `.manifast/` workspace so the views aren't empty (never overwrites your files) |
| `manifast init --rm-example` | Remove the seeded demo content (keeps any file you edited or added) |
| `manifast validate [dir]` | Check the workspace against the schemas + links; exits 1 on errors (`--strict` also fails on warnings) |
| `manifast --port <n>` | Use a specific port (default 4317; next free port if taken) |
| `manifast --no-open` | Don't open the browser |
| `manifast --help` / `--version` | Help / version |

## What `init` installs

```
.manifast/
  AGENTS.md                        # LLM-neutral authoring guide
  schema/*.json                    # JSON Schema (generated from the zod source)
  wireframes/  prd/  specs/  tasks/  plan/  diagrams/
.claude/skills/manifast/           # Claude Code skill + checklist/workflow docs
.claude/skills/{brainstorm,write-plan,implement}/
AGENTS.md / CLAUDE.md              # managed Manifast directive block, preserving your text
```

User-owned text is preserved; Manifast-managed files are refreshed when the
bundled guide/schema changes. Re-running `init` is safe.

## The views

- **Wireframes** — infinite canvas (space- or middle-drag to pan, ⌘/Ctrl+scroll
  to zoom, 10–400%) with a bottom thumbnail strip. Low-fidelity grayscale render
  of an 18-node catalog (Box, Text, Button, Input, Textarea, Checkbox, Radio,
  Toggle, Select, Image, Avatar, Icon, Divider, Badge, Navbar, Table, List, Tabs).
- **Docs** — a searchable doc rail + reader; PRD/spec Markdown (GFM: tables, task
  lists, highlighted code) with a frontmatter header card, linked-wireframe
  thumbnail, and task chips.
- **Tasks** — fixed 4-column kanban (todo / in_progress / done / blocked) with
  priority dots, spec/wireframe link chips, and dependency chips.
- **Plan** — vertical roadmap of phases with per-phase task progress.
- **Map** — relationship graph (auto-laid-out with dagre, pan/zoom) of how docs,
  wireframes, tasks and the plan connect; see [Maps & diagrams](#maps--diagrams-v3).
- **User Flow** — directed flow diagrams (`kind: "flow"`) with start/page/action/
  decision/end node types and labelled edges.
- **Tree** — hierarchy diagrams (`kind: "tree"`) for feature trees, sitemaps, and
  requirement breakdowns.

Links between items (spec ↔ wireframe ↔ task ↔ plan) are clickable chips that
jump to the target; broken links (missing ids) show greyed-out.

**Appearance** — toggle light/dark and pick an accent color (indigo / emerald /
orange / blue) from the header; both persist locally and default to your OS theme.

## Export

Per-view **Export** menus + a global **.zip** button in the header:

- Wireframe → PNG (2×), SVG, HTML (self-contained inline-style), JSON (original)
- Doc → Markdown (original), HTML (self-contained), Print/PDF (browser print)
- Whole workspace → ZIP of `.manifast/`

All export runs in the browser; the server only serves files.

## Document management (v2)

Manifast also works as a lightweight doc dashboard over your project's **existing**
docs, with lifecycle tracking:

- **Multiple sources** — docs are discovered from `.manifast/prd`, `.manifast/specs`,
  **and `docs/`** by default. Configure via `.manifast/manifast.json`:
  ```jsonc
  { "sources": { "docs": [".manifast/prd", ".manifast/specs", "docs", "rfcs"],
                 "exclude": ["docs/drafts"] } }
  ```
  Plain `.md` files (no frontmatter) are ingested too — title comes from the first
  `# H1` or filename, dates from the filesystem.
- **Lifecycle** — `status: draft | active | done | deprecated | archived` plus
  `createdAt`/`updatedAt`/`deprecatedAt`/`deprecatedBy`. Deprecated docs show a
  strikethrough + successor link; archived docs are hidden behind a toggle (or put
  them under `docs/archive/`).
- **Stable `uid` (move tracking)** — click **Adopt** on a doc to stamp a random
  `uid` into its frontmatter. The doc is then tracked by that `uid` across folder
  moves/renames; links keep resolving. (Distinct from the human-friendly `id`.)
- **Relationships & orphans** — connect docs to each other / to specs with
  frontmatter `related: [id, …]` (on top of spec→wireframe/tasks and task→spec).
  The **Map** flags *orphan* docs (no link in or out) so loose docs are easy to
  find and wire up; docs that share a `sources` code path count as related too.

This is the one place the app **writes** files — and only frontmatter
(`uid` + status/metadata), never the document body. It's an intentional, scoped
relaxation of v1's read-only rule (see [DESIGN.md Appendix B](https://github.com/guinnessNet/manifast/blob/main/docs/DESIGN.md)).
Full in-app body editing is not included.

## Maps & diagrams (v3)

The **Map** view visualizes relationships as a node/edge graph (auto-laid-out with
dagre, pan/zoom):

- **Auto project map** — built by the app from existing links (doc ↔ wireframe ↔
  task ↔ plan) + `uid`, no file needed. Click a node to jump to that item.
- **Agent-authored diagrams** — when you ask Claude/Codex to "diagram the
  architecture" or "map the docs", it analyzes the repo (incl. root `CLAUDE.md` /
  `AGENTS.md` / `README.md`, now ingested) and writes
  `.manifast/diagrams/<id>.json` (`manifast.diagram/1`: nodes/edges/groups/kind).
  Manifast lays it out and renders it — **the agent does the analysis, the app only
  draws** (no in-app AI). Architecture "tracking" = re-run analysis → updated diagram
  + `generatedAt` (deep history would need git).

## File formats

Authoritative details live in the installed `SKILL.md` / `AGENTS.md` and in
`.manifast/schema/*.json`. In short:

- `wireframes/<id>.json` — `schema: "manifast.wireframe/1"`, a screen with a
  `root` node tree. Each node has a parent-relative `frame {x,y,w,h}`. Only `Box`
  may contain `children`.
- `prd/prd.md`, `specs/<id>.md` — `schema: manifast.doc/1` YAML frontmatter
  (`id`, `type: prd|spec`, `title`, optional `status`, `wireframe`, `tasks[]`,
  `related[]`, `sources[]`, `updatedAt`) + Markdown body.
- `tasks/tasks.json` — `schema: "manifast.tasks/1"`, `tasks[]`.
- `plan/plan.json` — `schema: "manifast.plan/1"`, `phases[]`.
- `diagrams/<id>.json` — `schema: "manifast.diagram/1"`, `nodes[]`, `edges[]`,
  optional `groups[]`, `kind`, `layout`, and clickable `node.ref`.

Invalid JSON/frontmatter never blanks the screen: the offending item shows an
error banner; everything else keeps rendering.

## Development

```bash
npm install
npm run dev      # Vite (SPA + HMR) on :5173 proxying /api + /ws to the API on :4317
npm run build    # gen schema JSON → build SPA (dist/web) → bundle CLI (dist/cli)
npm run check    # headless SSR smoke test of the renderer + views
npm run typecheck
npm start        # run the built CLI (node dist/cli/index.js)
```

`npm run dev` watches `skill/examples/.manifast` by default; set `MANIFAST_DIR`
to point it elsewhere.

## Architecture

```
src/
  shared/schema/*   zod schemas — the single source of truth
  shared/types.ts   DTOs shared by server + web
  server/           Fastify: workspace discovery + zod validation, REST
                    (/api/workspace, /api/file, /api/files, /api/raw),
                    chokidar watcher (100 ms debounce), WS broadcast (/ws)
  cli/              `manifast` / `manifast init` (mri arg parsing, `open`)
  web/              Vite + React 19 + Tailwind v4 SPA
                    wireframe canvas+renderer (inline-styled, reused for export),
                    docs/tasks/plan views, link graph, live-reload hook
skill/              SKILL.md, AGENTS.md, schema/ (generated), examples/
scripts/            schema generation, server bundling, dev launcher, SSR check
```

The zod schemas generate `skill/schema/*.json` via `zod-to-json-schema`, so app
validation and the agent contract come from one source.

## Notable design choices (where DESIGN.md left it open)

- **shadcn-style, minimal**: lightweight Tailwind components (`cn` + cva) instead
  of pulling the full shadcn + Radix dependency tree — keeps runtime deps small.
- **chokidar v4** dropped glob watching, so the watcher watches the `.manifast/`
  directory recursively and filters paths (dotfiles ignored, `awaitWriteFinish`).
- Wireframe nodes render with **inline styles**, so the exact same DOM powers the
  on-screen canvas, the PNG/SVG (html-to-image), and the self-contained HTML
  serializer.
- YAML parses unquoted dates (`updatedAt: 2026-06-24`) to `Date`; the server
  normalizes them back to strings so frontmatter matches the schema.
- Export is per-view; the whole-workspace **ZIP** is a single global action.
- Dev runs Vite + the API server via a small shell-free Node launcher
  (`scripts/dev.mjs`) so it works cross-platform.

## Constraints (by design)

No authentication, no database, no cloud, no in-app Anthropic/MCP calls. Document
authoring is the agent's job; the app's only writes are doc frontmatter `uid` +
status/metadata (the v2 doc-management feature above) — never the document body,
and never wireframes/tasks/plan (those stay read-only).
