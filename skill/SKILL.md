---
name: manifast
description: Use when designing or editing UI wireframes, PRDs, feature specs, task boards, roadmaps, or architecture/doc-map diagrams for a project with a .manifast/ folder — and when structuring or organizing an existing docs/ folder, writing an ADR (decision record) or architecture doc, or keeping planning docs in sync with the code. Manifast is a local viewer; you author these as structured JSON + Markdown (with frontmatter) so the user sees wireframes, docs, a kanban board, a roadmap, and a project map with live reload.
---

# Manifast authoring skill

Manifast is a **local, read-only** tool. It renders the files in `.manifast/`.
You (the agent) are the only writer. When the user asks you to design screens or
write product docs, create/modify the files described here. Keep every file a
**valid** JSON or Markdown-with-frontmatter document at all times — the viewer
shows a red error banner for any file it can't parse, but keeps rendering the
rest.

**After authoring or editing, run `npx manifast validate`** (`--strict` also fails
on warnings). It re-checks every file against these schemas plus cross-references
(links, ids) and exits non-zero on any error — if it fails, you are not done.

## 0. Two working modes

**Mode A — structuring existing docs** (when the project already has a `docs/` pile). Read the
scattered docs and structure them so Manifast can visualize them. **Don't change everything at once —
propose → get user confirmation** (the app never writes the body — you are the sole author).
1. **Inventory**: skim `docs/` and the root `CLAUDE.md`/`AGENTS.md`/`README.md` to build a list.
2. **Type classification**: classify each doc with the *document type catalog* below.
3. **Mapping**: organize planning/design docs into `.manifast/` (prd·specs) or the tracked `docs/` per
   the rules and fill in their frontmatter. Draw code·doc relationships as a diagram (§5b).
(For the systematic procedure that also does dedup·ROT·IA proposals, follow the *structuring playbook* below.)

**Mode B — creating from scratch** (new project/feature). Build along the `spec → plan → tasks` spine:
a feature spec (`specs/<id>.md`) → roadmap (`plan/plan.json`) → tasks (`tasks/tasks.json`), plus a
wireframe if a screen is needed. Connect them with links (§6).

Common to both modes: create **only the canonical doc set that fits the project's nature** (don't force every type onto a small project).

## Document type catalog (first-class — but not mandatory)

Distinguished by frontmatter `type`; use only what you need.

| type | what | where | when |
|---|---|---|---|
| `prd` | product requirements | `.manifast/prd/` | product/proposal stage |
| `spec` | feature specification | `.manifast/specs/<id>.md` | per feature |
| `doc` | general description/note | `docs/` | other explanatory docs |
| `adr` | architecture decision record | `docs/adr/NNNN-*.md` | hard-to-reverse decisions |
| `architecture` | architecture overview (arc42) | `docs/architecture/` | describing system structure |
| `tutorial`·`howto`·`reference`·`explanation` | the 4 Diátaxis types | `docs/<type>/` | when there are user-facing docs |
| `plan` | implementation plan (per sprint/phase) | `docs/plans/` | per execution phase |
| `results` | completion report·exit decision | `docs/` | after a phase/milestone completes |
| `handoff` | work handoff (LLM/agent) | `docs/` | when handing off between agents |
| `prompt` | reusable canonical LLM prompt | `docs/prompts/` | when versioning prompts |

- **ADR**: one decision per file, **immutable**. To change a decision, don't edit it — create a new ADR
  and link the old one via `status: deprecated` + `deprecatedBy: <new ADR>` (status mapping: proposed→`draft`,
  accepted→`active`, superseded→`deprecated`).
- **arc42 + C4**: architecture *docs* use arc42 sections (only the ones you need); architecture *diagrams*
  use diagram (§5b) `kind: "architecture"` for C4 L1 (Context)/L2 (Container) only. Don't hand-draw down to L4 (code).
- **Diátaxis**: don't mix types on one page (learning=tutorial, task=howto, facts=reference, reasoning=explanation).
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

Rules: one screen per file in `wireframes/`, one spec per file in `specs/`.
`tasks.json` and `plan.json` are each a single file holding everything. Put
files only in these folders — never absolute paths or arbitrary locations. The
JSON Schemas in `.manifast/schema/*.json` are the authoritative contract.

**`manifast.json`** (optional project meta): `{ "schema": "manifast/1", "project": { "name",
"description"? }, "sources"?: { "docs"?: string[], "exclude"?: string[] } }`. `sources.docs` adds
extra doc roots (defaults: `.manifast/prd`, `.manifast/specs`, `docs`, and root
`CLAUDE.md`/`AGENTS.md`/`README.md`); `sources.exclude` prunes. Schema:
`.manifast/schema/manifast.schema.json`.

## 2. Wireframe schema (`wireframes/<id>.json`)

```jsonc
{
  "schema": "manifast.wireframe/1",
  "id": "screen-login",          // match the filename
  "name": "Login",               // display name
  "device": "mobile",            // "desktop" | "tablet" | "mobile"
  "size": { "w": 390, "h": 844 },// canvas size in px
  "background": "#FFFFFF",        // optional
  "root": [ /* WireNode[] */ ]
}
```

**Coordinates:** every node has `frame: { x, y, w, h }` in pixels, **relative to
its parent** (root nodes are relative to the screen). The renderer nests
children with the parent positioned relatively, so moving a Box moves its
children. Keep sibling frames from overlapping (use the recommended sizes).

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
| `Icon` | `name` (any lucide icon name, e.g. "users", "bar-chart") | `size` (default 24) |
| `Divider` | — | `orientation`: horizontal\|vertical |
| `Badge` | `label` | `tone`: neutral\|info\|success\|warning\|danger |
| `Navbar` | — | `brand` · `links`: string[] · `actions`: string[] |
| `Table` | `columns`: string[] | `rows` (default 5) |
| `List` | — | `items` (default 5) · `withAvatar` · `withIcon` |
| `Tabs` | `tabs`: string[] | `activeIndex` (default 0) |

Every node also needs `id`, `type`, `frame`. **Only `Box` may have `children`.**
`Navbar`/`Table`/`List`/`Tabs` draw themselves from their props (no children).

**Recommended default sizes (px):** Button 120×40 · Input/Textarea/Select 280×40
(**with `label`: 280×62** — the label stacks ~18px above the field box, so add
~22px height or the field renders squished) · Navbar (screen width)×64
· Avatar 40×40 · Icon 24×24 · Divider (parent width)×1
· Table 44/row · List 56/item.

## 3. PRD / spec (`prd/prd.md`, `specs/<id>.md`)

YAML frontmatter + Markdown body (GFM: tables, task lists, code blocks):

```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec            # prd|spec|doc|adr|architecture|tutorial|howto|reference|explanation|plan|results|handoff|prompt
title: User authentication
status: active        # draft | active | done | deprecated | archived (default draft)
wireframe: screen-login   # optional — link to a wireframe id
tasks: [task-1, task-2]   # optional — linked task ids
related: [feat-billing, arch-overview]  # optional — related doc/spec ids (doc↔doc links; both directions count)
owner: kjh                # optional — DRI (single owner)
sources: [src/auth/login.ts]  # optional — code this doc describes (concrete files; drives staleness)
reviewBy: 90              # optional — review TTL in days
lastReviewed: 2026-06-24  # optional — app stamps this on the "Review" action
critical: true            # optional
createdAt: 2026-03-01      # optional
updatedAt: 2026-06-24      # optional
deprecatedBy: feat-auth-v2 # optional — successor doc when status is deprecated
# uid: <managed by the app — do not invent; preserve it if present>
---

## Background
...free Markdown...
```

`schema`, `id`, `type`, `title` are required. Bad frontmatter is a non-fatal
warning (the body still renders) — but keep it valid.

**`id` rules**: `kebab-case`, **unique** across all Manifast docs in the project, the filename stem
recommended (e.g. `feat-auth.md` → `id: feat-auth`). Once it's referenced by a diagram `node.ref.id` or a
task `specId` it is **stable** — to change it you must update every reference (diagrams·tasks·plan) together.

**Document lifecycle & sources.** Manifast also ingests plain `.md` files from a
`docs/` folder (not just `.manifast/`), even without frontmatter. To deprecate or
archive a doc, set `status: deprecated` (with `deprecatedBy` + `deprecatedAt`) or
`status: archived` (or move it under `docs/archive/`). The app manages a stable
`uid` for tracking docs across moves — never invent one, but keep it if present.

**Root files (`CLAUDE.md`·`AGENTS.md`·`README.md`)**: Manifast ingests them but does **not add** Manifast
frontmatter. `CLAUDE.md`/`AGENTS.md` are AI-instruction files, so they sit outside the Manifast lifecycle.
You may add frontmatter to `README.md` if needed, but it isn't required. When referencing them from a
diagram, use the `{ kind: "path", id: "CLAUDE.md" }` form (no frontmatter `id`, so a `doc` ref is not allowed).

## 4. Task board (`tasks/tasks.json`)

```json
{
  "schema": "manifast.tasks/1",
  "tasks": [
    {
      "id": "task-1",
      "title": "Build login form",
      "status": "in_progress",
      "priority": "high",
      "specId": "feat-auth",
      "wireframeId": "screen-login",
      "deps": []
    }
  ]
}
```

`status` ∈ todo | in_progress | done | blocked (the 4 fixed kanban columns).
`priority` ∈ low | med | high (default med). `specId`, `wireframeId`, `deps`
are optional links.

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

`status` ∈ planned | active | done (default planned). Each phase links tasks via
`taskIds`.

## 5b. Diagrams — architecture & maps (`.manifast/diagrams/<id>.json`)

When asked to visualize the **codebase architecture** or a **document/feature map**,
write a generic node/edge diagram. The app lays it out automatically (you do NOT set
coordinates) and renders it in the **Map** view.

```json
{
  "schema": "manifast.diagram/1",
  "id": "arch",
  "title": "System architecture",
  "kind": "architecture",        // architecture | docmap | sitemap | flow | ...
  "layout": "layered",           // layered | radial | tree (optional — inferred from kind)
  "direction": "LR",             // TB | LR | BT | RL (optional; used by layered/tree)
  "groups": [{ "id": "api", "label": "API" }],
  "nodes": [
    { "id": "server", "label": "API server", "group": "api", "kind": "service" },
    { "id": "db", "label": "Postgres", "kind": "db" }
  ],
  "edges": [{ "from": "server", "to": "db", "kind": "reads", "label": "SQL" }]
}
```

**Pick the layout to match the content's shape — this is the #1 lever on readability.**
The app renders three strategies; set `layout` explicitly, or let it be inferred from `kind`:

| content shape | `layout` | `kind` that infers it | looks like |
|---|---|---|---|
| **document/feature relationships** (many-to-many cross-refs) | `radial` | `docmap` · `mindmap` · `relations` | **mind map** — a hub at center, related nodes on rings outward |
| **sitemap / feature tree** (single-parent hierarchy) | `tree` | `sitemap` · `tree` · `hierarchy` | top-down tidy tree (use feature-tree node kinds, below) |
| **user flow / screen flow** (start → page → action → decision) | `layered` | `flow` · `userflow` | a **flow**: typed nodes + arrowed, labelled edges. Gets its own **User Flow** tab |
| **backend / architecture / dataflow** (directional tiers) | `layered` | `architecture` · everything else | dagre lanes, `groups` as tiers, follows `direction` |

Rules of thumb:
- **Relationships → `radial`, NOT layered.** A doc/concept map forced through layered dagre
  reads as a meaningless left-right flow. Radial picks the highest-degree node as the hub;
  author so the *intended* center is the most-connected node. `groups` are not drawn in radial
  (a mind map is hub-centric) — rely on `node.kind` tints instead. Use `kind: "doc"` /
  `"wireframe"` / `"task"` on nodes so they get per-type hues + icons, and add
  `ref: { kind: "doc", id }` so chips click through. See
  `examples/.manifast/diagrams/doc-map.json`.
- **Architecture/backend → `layered`** with `groups` as tiers (e.g. `ui` / `api` / `data`) and a
  consistent `direction`. This is the one case dagre is right for.
- **Keep a hand-authored diagram focused (≤ ~25 nodes).** Big graphs are for the auto map, which
  aggregates (below). If you need more, split into several diagrams or use groups as tiers.

- **User flow** (`kind: "flow"`) — model a screen/process flow as directed, **labelled** edges
  (`label: "Click Login"`, `"Yes"`, `"No"`). Give nodes a typed `kind` so they render distinctly:
  `start` / `end` (green/red **pills**), `page` (a screen — add `ref: { kind: "wireframe", id }`
  so it clicks through), `action` (a user action), `decision` (a branch). Set `direction` (`TB`
  top-down or `LR` left-right). These appear in the dedicated **User Flow** tab. See
  `examples/.manifast/diagrams/user-flow.json`.
- **Feature tree** (`kind: "tree"`) — model `project → requirement → feature → detail` as
  parent→child edges; tag nodes with those kinds for per-level color, and put the 1–3 line intent
  in `node.description`. Renders top-down in the dedicated **Tree** tab. See
  `examples/.manifast/diagrams/feature-tree.json`.

- Analyze the real project (folders, modules, imports/deps, entry points — and the
  root `CLAUDE.md` / `AGENTS.md` / `README.md`, which Manifast now also shows) and
  emit nodes + edges. Don't compute positions; the app handles layout.
- `node.kind` gives a node its visual: architecture `module|service|layer|db|external|folder`
  (subtle left-border hue); user-flow `start|page|action|decision|end` and feature-tree
  `project|requirement|feature|detail` render as typed filled nodes (terminators as pills);
  anything else is a neutral box. `edge.kind` is
  free-form, but **prefer the recommended vocabulary below**, and use `other` when nothing fits:
  `implements` · `supersedes` · `references` · `plans-for` · `results` · `includes` ·
  `uses` · `produces` · `rollup` · `absorbed-by` · `next` · `sibling`.
- `node.ref` makes a node clickable + freshness-aware. Prefer **`{ kind: "doc", id }`** for a
  tracked doc; use `{ kind: "wireframe"|"task", id }` for those; for a doc/file without a
  frontmatter `id`, use **`{ kind: "path", id: "<repo-relative path>" }`** — the app resolves it
  to the doc so it still clicks and shows staleness. (Giving the doc a frontmatter `id` + `doc`
  ref is cleaner.)
- Set `generatedAt` when you (re)generate it. Don't leave half the nodes edgeless — add
  `relates`/`supersedes` edges or rely on groups so the map reads as structure, not a list.
- Manifast also shows an **auto** project map (doc↔wireframe↔task↔plan links) with no file
  needed. It is `docmap` (renders radial). **At scale (40+ docs) it aggregates by default** —
  docs collapse into `dir:<folder>` super-nodes (with counts) and tasks into their plan phase,
  so it reads as a ~dozen-node structure overview instead of a hairball. The Map toolbar has
  **Expand individual docs / Aggregate by folder** to toggle, plus **focus** (click a node → its neighborhood)
  for drill-down. So you do not need to hand-author a diagram just to see project structure.

## 6. Links (single source of truth — no duplication)

| link | where it lives |
|---|---|
| spec → wireframe | spec frontmatter `wireframe` |
| spec → tasks | spec frontmatter `tasks[]` |
| task → spec / screen | task `specId` / `wireframeId` |
| task → task (prereq) | task `deps[]` |
| plan → tasks | phase `taskIds[]` |
| doc ↔ doc / doc → spec | doc frontmatter `related[]` (when there's no spec/task/wireframe link to express the tie) |

Reference ids that actually exist (the viewer greys out broken links).

**Connectivity is the goal — avoid orphan docs.** A doc is an *orphan* if it has
no link at all: no `wireframe`/`tasks`/`deprecatedBy`/`related` of its own, no
task `specId` pointing at it, and no shared `sources` path with another doc. The
Map flags these ("N orphan docs") and hides them by default. When you author or
adopt a project, **trace each doc's real relationships and wire them** so it joins
the graph — prefer the specific link (spec→wireframe/tasks, task→spec) and fall
back to `related` for doc↔doc / doc→spec ties that no other field expresses.
**Target: ≥90% of docs linked** (orphan rate < 10%). Treat reaching ~90% as done —
the remaining <10% should be genuinely standalone (e.g. a changelog, a license, a
scratch note), not docs you simply didn't connect. Don't invent fake links to hit
the number; if a doc truly relates to nothing, leaving it orphan is correct.

## 7. Few-shot example

`.manifast/wireframes/screen-login.json`
```json
{
  "schema": "manifast.wireframe/1",
  "id": "screen-login", "name": "Login", "device": "mobile",
  "size": { "w": 390, "h": 844 }, "background": "#FFFFFF",
  "root": [
    { "id": "t", "type": "Text", "frame": { "x": 24, "y": 96, "w": 342, "h": 36 },
      "content": "Login", "role": "h1" },
    { "id": "email", "type": "Input", "frame": { "x": 24, "y": 160, "w": 342, "h": 44 },
      "label": "Email", "placeholder": "you@example.com", "kind": "email" },
    { "id": "pw", "type": "Input", "frame": { "x": 24, "y": 224, "w": 342, "h": 44 },
      "label": "Password", "kind": "password" },
    { "id": "go", "type": "Button", "frame": { "x": 24, "y": 296, "w": 342, "h": 48 },
      "label": "Sign in", "variant": "primary", "size": "lg" }
  ]
}
```

`.manifast/specs/feat-auth.md`
```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec
title: User authentication
status: active
wireframe: screen-login
tasks: [task-1]
---

## Goal
Email/password login.
```

`.manifast/tasks/tasks.json`
```json
{ "schema": "manifast.tasks/1",
  "tasks": [ { "id": "task-1", "title": "Build login form", "status": "in_progress",
    "priority": "high", "specId": "feat-auth", "wireframeId": "screen-login" } ] }
```

## Structuring playbook (Mode A in detail — cleaning up an existing pile)

Follow this when structuring an existing `docs/` pile. Don't do it all at once — show results step by step.

**Auto-apply vs hold (clear even when headless):** even in a batch/headless run where you can't get human
confirmation, apply the "safe" actions below immediately, and don't apply the "hold" ones — report them as a list.
- **Safe (apply immediately)**: adding/editing frontmatter (id/type/title/status/owner/sources/reviewBy/lastReviewed),
  setting `status: deprecated|archived` (reversible), creating/updating a docmap diagram.
- **Hold (propose·report only)**: deleting·merging·moving files, editing the (markdown) body. (The app never
  writes the body either — structuring is expressed only through frontmatter·new files.)

0. **Back up first**: before starting, commit the current state to a `backup/pre-manifast-<YYYY-MM-DD>`
   branch. If you don't like the outcome, you can revert to it. Skippable if you're already on a separate work branch.
1. **Inventory (read-only)**: put every doc in a table — path · title (first H1) · last modified · rough size · tentative type.
2. **Summary + metadata**: for each doc, propose a short summary and metadata (type·topic·`owner` candidate)
   against the frontmatter schema (§3).
3. **Dedup**: classify overlapping pairs as duplicate (merge) / variant (keep — context differs) / **conflict
   (contradiction — ask a human)**. For duplicates, keep 1 canonical + mark the rest `deprecated` (point at the canonical via `deprecatedBy`).
4. **ROT classification**: pick out Redundant / Outdated / Trivial docs by computable signals (duplication·staleness·broken
   links·missing `sources` symbols) and propose keep / update / merge / archive / **delete**. **Ask the delete question first**
   (if it's deleted, the remaining edit questions are moot). Never delete arbitrarily.
5. **Type classification (Diátaxis)**: tag each doc with a catalog type, and if types are mixed on one page, propose splitting it.
6. **IA proposal**: group by topic to propose a folder structure, then let a human finalize/rename. Planning·design goes in `.manifast/`,
   explanation/user docs in `docs/<type>/`.
7. **Gap analysis**: overlay docs onto the code surface (public API·CLI·config·main modules) and report **missing/thin** docs.
8. **Migration**: canonical IA + merge map + (when moving) a tombstone/`deprecated` notice at the old path. Apply in small
   batches. When done, draw the resulting structure as a diagram (§5b) so a human can eyeball-review it.
9. **Relationship wiring (remove orphans)**: trace doc-to-doc / doc↔spec·task·screen relationships and wire them via
   frontmatter (§6) — prefer the specific link (spec→wireframe/tasks, task→`specId`), and for doc↔doc·doc→spec ties
   that nothing else can express, connect them with `related[]`. **Done criterion: ≥90% of docs are linked**
   (the Map's "N orphan docs" < 10% of the total). Treat reaching ~90% as done — the remaining <10% should be genuinely
   standalone docs (changelog·license·one-off note), not docs you simply didn't wire up. Don't fabricate
   links to hit the number. Leaving a truly unrelated doc as an orphan is correct.

**After Mode A completes — switching to hybrid operation:**
Once structuring is done, create new docs directly in `.manifast/` in Manifast format from the start.
- **Design·planning** (spec, PRD, ADR, architecture): `.manifast/specs/` or `.manifast/prd/`
- **Execution records** (plans, results, handoffs): `docs/` — manage frontmatter only
- Leave `docs/` for execution records and domain reference only.
Keep this boundary and your `.manifast/` files are always structurally guaranteed, while `docs/` stays free-form.

## Keeping freshness & drift in check (ongoing)

- **`sources` is a required declaration on every doc**: docs in `active`·`done`·`draft` status must,
  without exception, declare `sources` in frontmatter. **Omitting the `sources` field itself is not allowed.**
  - **Code-adjacent docs** (the body mentions code paths·module names like `services/`, `apps/`, `src/`, `.py`, `.ts`):
    list concrete files or a directory prefix. E.g. `[services/worker/domain/grammar.py]`
  - **Code-unrelated docs** (pure reference·checklist·index·process docs):
    `sources: []` — use an empty array to **explicitly declare** "no code".
  - **`deprecated`·`archived`**: `sources: []` (excluded from freshness checks).
  When a `sources` file's mtime is newer than `lastReviewed`, the app shows a **stale** badge (compared without AI).
- **Judging drift is on you**: when code changes, find the affected docs (by cited symbols·`sources`, preferring
  a structural/AST basis over a text diff) and **fix the docs in the same task**.
- **Review cadence**: give important docs an `owner` and a `reviewBy` (in days). After reviewing, a human refreshes
  (re-blesses) `lastReviewed` via the app's **Review** button. **You fill in only `reviewBy` and leave `lastReviewed` empty** —
  filling it in ahead of time kills the stale signal from the start. Exception: stamp today's date only when you've
  directly verified correctness in an explicit drift-fix pass.
- **Status hygiene**: don't delete a doc that no longer holds — mark it `deprecated` (with a successor `deprecatedBy`) or
  `archived`. Archived docs are excluded from freshness checks.
- **Large files·encoding**: for files **100KB or larger**, read **only the head (~16KB)** to classify them — the app also
  reads only the first 16KB in the listing, so anything past that isn't reflected in the metadata. Don't read the whole thing. Keep frontmatter at the very top of the file, and when adding it **preserve the existing line endings (EOL)**
  (mixing LF/CRLF makes diffs messy).

## 8. Task-completion checklist

Every time a code change wraps up, run the `manifast-checklist` skill (`.claude/skills/manifast/CHECKLIST.md`):
update tasks.json status → plan.json progress → check sources drift → create specs for new features → refresh diagrams.

To automate the whole feature-development process (design→plan→implement), use the `manifast-workflow` skill (`.claude/skills/manifast/WORKFLOW.md`).

## 9. Don't

- Don't invent node `type`s outside the 18-item catalog.
- Don't put `children` on anything except `Box`.
- Don't write files outside `.manifast/` or use absolute paths.
- Don't edit `.manifast/schema/*.json` (generated contract).
- Don't leave a file as invalid JSON/frontmatter. After edits, bump `updatedAt`.
