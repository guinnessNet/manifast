# Manifast authoring guide (for Codex / any agent)

This project uses **Manifast** — a local, read-only viewer that visualizes the
files in `.manifast/` (wireframes, PRD/specs, a task board, and a roadmap) with
live reload. **You are the only writer.** When asked to design screens or write
product docs, create/modify the files described below. Keep every file a valid
JSON or Markdown-with-frontmatter document — the viewer shows an error banner for
anything it can't parse but keeps rendering the rest.

**After authoring or editing, run `npx manifast validate`** (add `--strict` to fail
on warnings too). It re-checks the whole workspace against these schemas + the
cross-references (links, ids) and exits non-zero on any error — if it fails, you
are not done. This is the LLM-agnostic gate: it holds regardless of which agent or
tool wrote the files.

> If a `.claude/skills/manifast/SKILL.md` exists, it contains the same guidance.

## 0. Two working modes

**Mode A — structure existing docs** (when the project already has a `docs/` pile). Read the
scattered documents and structure them so Manifast can visualize them. **Don't change everything at
once — proceed by proposal → user confirmation** (the app never writes the body — you are the only author).
1. **Inventory**: skim `docs/` and root `CLAUDE.md`/`AGENTS.md`/`README.md` to build a list.
2. **Type classification**: classify each document with the *document type catalog* below.
3. **Mapping**: organize planning/design docs into `.manifast/` (prd·specs) or tracked `docs/` per the
   rules and fill in the frontmatter. Draw code/doc relationships as diagrams (§5b).
(For the systematic procedure that goes all the way to deduplication · ROT · IA proposals, follow the *structuring playbook* below.)

**Mode B — create new** (new project/feature). Build along the `spec → plan → tasks` spine: a feature spec
(`specs/<id>.md`) → roadmap (`plan/plan.json`) → tasks (`tasks/tasks.json`), plus a wireframe if a screen
is needed. Connect them with links (§6).

Common to both modes: create **only the canonical set of documents that fits the project's nature** (don't force every type onto a small project).

## Document type catalog (first-class — but not mandatory)

Distinguish them with the frontmatter `type`, and use only what you need.

| type | what | where | when |
|---|---|---|---|
| `prd` | product requirements | `.manifast/prd/` | product/proposal stage |
| `spec` | feature spec | `.manifast/specs/<id>.md` | per feature |
| `doc` | general explanation/note | `docs/` | any other explanatory doc |
| `adr` | architecture decision record | `docs/adr/NNNN-*.md` | hard-to-reverse decisions |
| `architecture` | architecture overview (arc42) | `docs/architecture/` | describing system structure |
| `tutorial`·`howto`·`reference`·`explanation` | the 4 Diátaxis types | `docs/<type>/` | when there are user-facing docs |
| `plan` | implementation plan (per sprint/phase) | `docs/plans/` | per execution phase |
| `results` | completion report · Exit verdict | `docs/` | after a phase/milestone completes |
| `handoff` | work handoff (LLM/agent) | `docs/` | when handing off between agents |
| `prompt` | canonical reusable LLM prompt | `docs/prompts/` | when versioning prompts |

- **ADR**: one decision per file, **immutable**. To change a decision, don't edit it — create a new ADR and
  link the old one with `status: deprecated` + `deprecatedBy: <new ADR>` (status mapping: proposed→`draft`,
  accepted→`active`, superseded→`deprecated`).
- **arc42 + C4**: architecture *docs* use arc42 sections (only the ones you need); *diagrams* use the diagram (§5b)
  `kind: "architecture"` for C4 L1 (Context)/L2 (Container) only. Don't hand-draw down to L4 (code).
- **Diátaxis**: don't mix types on one page (learning=tutorial, task=howto, fact=reference, reason=explanation).
- For a small project, `prd`/`spec`/`doc` + tasks/plan is enough. **Adding more types is not the goal.**

## 1. Folder layout (one file per item)

```
.manifast/
  manifast.json            # project meta (optional)
  schema/*.json            # JSON Schema (validation contract — do not edit)
  wireframes/<id>.json     # ONE screen per file  (id should match filename)
  prd/prd.md               # the PRD (Markdown + YAML frontmatter)
  specs/<feature-id>.md    # ONE feature spec per file
  tasks/tasks.json         # the whole task board (single file)
  plan/plan.json           # the implementation plan/roadmap (single file)
  diagrams/<id>.json       # ONE authored diagram per file (architecture/docmap/flow/tree)
```

Put files only in these folders — never absolute paths or arbitrary locations.
The JSON Schemas in `.manifast/schema/*.json` are the authoritative contract.

**`manifast.json`** (optional project meta): `{ "schema": "manifast/1", "project": { "name",
"description"? }, "sources"?: { "docs"?: string[], "exclude"?: string[] } }`. `sources.docs` adds
extra doc roots (defaults: `.manifast/prd`, `.manifast/specs`, `docs`, root
`CLAUDE.md`/`AGENTS.md`/`README.md`); `sources.exclude` prunes. Schema:
`.manifast/schema/manifast.schema.json`.

## 2. Wireframe schema (`wireframes/<id>.json`)

```jsonc
{
  "schema": "manifast.wireframe/1",
  "id": "screen-login",          // match the filename
  "name": "Login",
  "device": "mobile",            // "desktop" | "tablet" | "mobile"
  "size": { "w": 390, "h": 844 },
  "background": "#FFFFFF",        // optional
  "root": [ /* WireNode[] */ ]
}
```

**Coordinates:** every node has `frame: { x, y, w, h }` in pixels, **relative to
its parent** (root nodes are relative to the screen). Moving a `Box` moves its
children. Keep sibling frames from overlapping.

**Node catalog — exactly these 18 `type`s, nothing else:**

| type | required | optional |
|---|---|---|
| `Box` | — | `variant`: card\|section\|plain · `children`: WireNode[] |
| `Text` | `content` | `role`: h1\|h2\|h3\|body\|caption\|label · `align`: left\|center\|right |
| `Button` | `label` | `variant`: primary\|secondary\|ghost · `size`: sm\|md\|lg |
| `Input` | — | `label` · `placeholder` · `kind`: text\|search\|password\|email\|number |
| `Textarea` | — | `label` · `placeholder` · `rows` (default 3) |
| `Checkbox` | — | `label` · `checked` |
| `Radio` | — | `label` · `checked` |
| `Toggle` | — | `label` · `on` |
| `Select` | — | `label` · `placeholder` · `options`: string[] |
| `Image` | — | `ratio` (e.g. "16:9") · `label` (default "Image") |
| `Avatar` | — | `shape`: circle\|square |
| `Icon` | `name` (lucide icon) | `size` (default 24) |
| `Divider` | — | `orientation`: horizontal\|vertical |
| `Badge` | `label` | `tone`: neutral\|info\|success\|warning\|danger |
| `Navbar` | — | `brand` · `links`: string[] · `actions`: string[] |
| `Table` | `columns`: string[] | `rows` (default 5) |
| `List` | — | `items` (default 5) · `withAvatar` · `withIcon` |
| `Tabs` | `tabs`: string[] | `activeIndex` (default 0) |

Every node needs `id`, `type`, `frame`. **Only `Box` may have `children`.**
`Navbar`/`Table`/`List`/`Tabs` draw themselves from their props (no children).

**Recommended default sizes (px):** Button 120×40 · Input/Textarea/Select 280×40
· Navbar (screen width)×64 · Avatar 40×40 · Icon 24×24 · Divider (parent width)×1
· Table 44/row · List 56/item.

## 3. PRD / spec (`prd/prd.md`, `specs/<id>.md`)

YAML frontmatter + Markdown body (GFM supported):

```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec            # prd|spec|doc|adr|architecture|tutorial|howto|reference|explanation|plan|results|handoff|prompt
title: User authentication
status: active        # draft | active | done | deprecated | archived (default draft)
wireframe: screen-login   # optional link to a wireframe id
tasks: [task-1, task-2]   # optional linked task ids
related: [feat-billing, arch-overview]  # optional related doc/spec ids (doc↔doc links)
owner: kjh                # optional — DRI (single owner)
sources: [src/auth/login.ts]  # optional — code this doc describes (concrete files; drives staleness)
reviewBy: 90              # optional — review TTL in days
lastReviewed: 2026-06-24  # optional — app stamps this on the "Review" action
critical: true            # optional
createdAt: 2026-03-01      # optional
updatedAt: 2026-06-24      # optional
deprecatedBy: feat-auth-v2 # optional — successor doc when deprecated
# uid: <managed by the app — do not invent; preserve if present>
---

## Background
...free Markdown...
```

`schema`, `id`, `type`, `title` are required. Manifast also ingests plain `.md`
from a `docs/` folder (no frontmatter needed). Deprecate/archive via
`status: deprecated|archived` (or move under `docs/archive/`). A stable `uid` is
app-managed for move tracking — never invent one, but preserve it if present.

**`id` rules**: `kebab-case`, **unique** across all Manifast documents in the project, filename stem recommended
(e.g. `feat-auth.md` → `id: feat-auth`). Once referenced by a diagram `node.ref.id` or a task `specId`, it is
**stable** — to change it you must update every reference (diagrams · tasks · plan) together.

**Root files (`CLAUDE.md`·`AGENTS.md`·`README.md`)**: Manifast ingests them but **does not add** Manifast
frontmatter. `CLAUDE.md`/`AGENTS.md` are AI-instruction files, so they sit outside the Manifast lifecycle.
`README.md` may have frontmatter added if needed, but it's not required. To reference them from a diagram, use
the `{ kind: "path", id: "CLAUDE.md" }` form (there's no frontmatter `id`, so a `doc` ref is not allowed).

## 4. Task board (`tasks/tasks.json`)

```json
{
  "schema": "manifast.tasks/1",
  "tasks": [
    { "id": "task-1", "title": "Build login form", "status": "in_progress",
      "priority": "high", "specId": "feat-auth", "wireframeId": "screen-login", "deps": [] }
  ]
}
```

`status` ∈ todo | in_progress | done | blocked. `priority` ∈ low | med | high
(default med). `specId`, `wireframeId`, `deps` are optional links.

## 5. Plan / roadmap (`plan/plan.json`)

```json
{
  "schema": "manifast.plan/1",
  "phases": [
    { "id": "p1", "name": "MVP auth", "goal": "login/signup",
      "status": "active", "taskIds": ["task-1", "task-2"] }
  ]
}
```

`status` ∈ planned | active | done (default planned).

## 5b. Diagrams — architecture & maps (`.manifast/diagrams/<id>.json`)

To visualize **codebase architecture** or a **document/feature map**, write a generic
node/edge diagram. The app auto-lays it out (don't set coordinates) and renders it in
the **Map** view.

```json
{
  "schema": "manifast.diagram/1",
  "id": "arch",
  "title": "System architecture",
  "kind": "architecture",
  "direction": "LR",
  "groups": [{ "id": "api", "label": "API" }],
  "nodes": [
    { "id": "server", "label": "API server", "group": "api", "kind": "service" },
    { "id": "db", "label": "Postgres", "kind": "db" }
  ],
  "edges": [{ "from": "server", "to": "db", "kind": "reads", "label": "SQL" }]
}
```

Analyze the real project (folders, modules, deps, entry points, and root
`CLAUDE.md`/`AGENTS.md`/`README.md` — all read by Manifast) → emit nodes + edges.
`node.kind` tints the box; `edge.kind` is free-form, but prefer the recommended vocabulary first and use
`other` if nothing fits: `implements` · `supersedes` · `references` · `plans-for` · `results` · `includes` ·
`uses` · `produces` · `rollup` · `absorbed-by` · `next` · `sibling`. `node.ref` makes a node
clickable + freshness-aware: prefer `{kind:"doc", id}` for a tracked doc (or
`{kind:"wireframe"|"task", id}`); for a doc/file without a frontmatter `id` use
`{kind:"path", id:"<repo-relative path>"}` — the app resolves it to the doc so it still
clicks and shows staleness. Don't leave half the nodes edgeless — add relates/supersedes
edges or rely on groups. Manifast also shows an auto project map (links) with no file needed.

Pick `kind`/`layout` to match the shape: `flow`/`userflow` → directional **user flow** (its own
**User Flow** tab) with typed nodes `start|end` (pills) · `page` (add `ref:{kind:"wireframe",id}`) ·
`action` · `decision`, and **labelled** edges (`"Yes"`/`"No"`); `tree`/`sitemap` → top-down
**feature tree** (its own **Tree** tab; `project|requirement|feature|detail` parent→child edges,
intent in `description`); `docmap`/`mindmap` → radial mind map; else → layered architecture. See
`examples/.manifast/diagrams/{user-flow,feature-tree}.json`.

## 6. Links (single source of truth — no duplication)

| link | where it lives |
|---|---|
| spec → wireframe | spec frontmatter `wireframe` |
| spec → tasks | spec frontmatter `tasks[]` |
| task → spec / screen | task `specId` / `wireframeId` |
| task → task (prereq) | task `deps[]` |
| plan → tasks | phase `taskIds[]` |
| doc ↔ doc / doc → spec | doc frontmatter `related[]` (when no spec/task/wireframe link expresses the tie) |

Reference ids that actually exist (the viewer greys out broken links).

**Connectivity is the goal — avoid orphan docs.** A doc is an *orphan* when it has
no link at all (no `wireframe`/`tasks`/`deprecatedBy`/`related`, no task `specId`
pointing at it, no shared `sources` path). The Map flags these and hides them by
default. When authoring or adopting a project, trace each doc's real relationships
and wire them — prefer the specific link, fall back to `related` for doc↔doc /
doc→spec ties. **Target ≥90% of docs linked** (orphan rate < 10%); reaching ~90%
is "done". The remaining <10% should be genuinely standalone, not docs you simply
didn't connect. Never invent fake links to hit the number.

## Structuring playbook (Mode A detail — cleaning up an existing pile)

Follow this when structuring an existing `docs/` pile. Don't do it all at once — show results step by step.

**Autonomous apply vs. hold (clear even when headless):** even in a batch/headless run without human
confirmation, apply the "safe" items below immediately, and don't apply the "hold" items — report them as a list.
- **Safe (apply immediately)**: adding/editing frontmatter (id/type/title/status/owner/sources/reviewBy/lastReviewed),
  setting `status: deprecated|archived` (reversible), creating/updating a docmap diagram.
- **Hold (propose/report only)**: deleting, merging, or moving files, and editing the (markdown body). (The app never
  writes the body either — structuring is expressed only through frontmatter and new files.)

0. **Back up first**: before starting, commit the current state to a `backup/pre-manifast-<YYYY-MM-DD>` branch.
   If you don't like the results you can revert to this branch. Skippable if you're already on a separate working branch.
1. **Inventory (read-only)**: all documents in a table — path · title (first H1) · last modified · rough size · tentative type.
2. **Summary + meta**: for each document, propose a short summary and meta (type · topic · `owner` candidate),
   matching the frontmatter schema (§3).
3. **Deduplication**: classify overlapping pairs as duplicate (merge) / variant (different context, keep) / **conflict
   (contradiction — ask the human)**. For duplicates, keep 1 canonical + mark the rest `deprecated` (pointing at the canonical via `deprecatedBy`).
4. **ROT classification**: narrow Redundant / Outdated / Trivial down via computable signals (duplication · staleness · broken links · missing
   `sources` symbols) and propose keep / update / merge / archive / **delete**. **Ask the delete questions first**
   (if it's a delete, the remaining edit questions are moot). Never delete arbitrarily.
5. **Type classification (Diátaxis)**: tag each document with a catalog type, and if types are mixed on one page, propose splitting them.
6. **IA proposal**: group by topic to propose a folder structure and let the human confirm/rename. Planning/design in `.manifast/`,
   explanatory/user docs in `docs/<type>/`.
7. **Gap analysis**: overlay docs onto the code surface (public API · CLI · config · main modules) and report **missing/thin** docs.
8. **Migration**: canonical IA + merge map + (when moving) a tombstone/`deprecated` note at the old path. Apply in small batches.
   When done, draw the resulting structure as a diagram (§5b) so the human can review it visually.

**After Mode A completes — switch to hybrid operation:**
Once structuring is done, create new documents directly in `.manifast/` in Manifast format from the start.
- **Design/planning** (spec, PRD, ADR, architecture): `.manifast/specs/` or `.manifast/prd/`
- **Execution records** (plans, results, handoffs): `docs/` — manage frontmatter only
- Leave `docs/` for execution records and domain reference only.
Keeping this boundary guarantees `.manifast/` files always have structure, while `docs/` stays free to write in.

## Freshness & drift maintenance (ongoing)

- **`sources` is a required declaration on every document**: `active`·`done`·`draft` documents must, without exception,
  declare `sources` in their frontmatter. **A missing `sources` field itself is not allowed.**
  - **Code-adjacent docs** (the body mentions code paths/module names like `services/`, `apps/`, `src/`, `.py`, `.ts`):
    list concrete files or a directory prefix. Example: `[services/worker/domain/grammar.py]`
  - **Code-unrelated docs** (pure reference · checklist · index · process docs):
    `sources: []` — use an empty array to **explicitly declare** "no code".
  - **`deprecated`·`archived`**: `sources: []` (excluded from freshness checks).
  If the mtime of a `sources` file is newer than `lastReviewed`, the app shows a **stale** badge (comparison without AI).
- **Drift judgment is your job**: when code changes, find the affected documents (by cited symbols · `sources`, preferring
  structure/AST over a text diff) and **fix the docs in the same task**.
- **Review cadence**: give important docs an `owner` and a `reviewBy` (days). When a review is done, the human updates
  `lastReviewed` (re-bless) via the app's **Review** button. **You fill in only `reviewBy` and leave `lastReviewed` empty** —
  filling it in advance kills the stale signal from the start. Exception: stamp today's date only when you've directly verified
  accuracy in an explicit drift-fix pass.
- **Status housekeeping**: don't delete a document that no longer holds — mark it `deprecated` (with a successor `deprecatedBy`) or
  `archived`. Archived docs are excluded from freshness checks.
- **Large files · encoding**: for files **100KB or larger**, classify by **reading only the head (~16KB)** — the app also reads
  only the first 16KB in the listing, so content past that isn't reflected in the meta. Don't read the whole thing. Put frontmatter at
  the very top of the file, and when inserting it, **preserve the existing line endings (EOL)** (mixing LF/CRLF makes diffs messy).

## 7. Task completion checklist

Whenever a code change finishes, run `CHECKLIST.md` (same directory):
update tasks.json status → plan.json progress → check sources drift → create specs for new features → update diagrams.

To automate the whole feature-development process (design→plan→implement), use `WORKFLOW.md` (same directory).

## 8. Don't

- Don't invent node `type`s outside the 18-item catalog.
- Don't put `children` on anything except `Box`.
- Don't write files outside `.manifast/` or use absolute paths.
- Don't edit `.manifast/schema/*.json` (generated contract).
- Don't leave a file as invalid JSON/frontmatter. After edits, bump `updatedAt`.
