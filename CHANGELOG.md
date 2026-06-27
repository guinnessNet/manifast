# Changelog

All notable changes to Manifast. (Local package; not published to npm — install
globally with `npm install -g .` after bumping the version.)

## Unreleased

**Skill — Mode A: raw-preserve + huge-doc chunking + provenance.** The structuring
playbook (`SKILL.md` / `AGENTS.md`, step 5) now covers splitting oversized/multi-topic
docs into focused Diátaxis pieces while **preserving the verbatim original under
`docs/archive/raw/`** (auto-archived) and wiring each piece back to the raw + siblings
via `sources` + `related` (so nothing — including the raw — is orphaned). Bodies are
sliced verbatim (no rewriting); the old path becomes a short index. No schema/app
change — uses existing fields and the `docs/archive/` auto-archive behavior. Piloted on
this repo's own `docs/DESIGN.md`.

## 1.2.15

**Fewer false orphan docs — doc↔doc relationships.** The Map flagged docs as
"orphans" using only wireframe/tasks/deprecatedBy/`task.specId`, so ordinary
`docs/` files (which carry none of those) all showed as orphans even when clearly
related. Now:

- **New doc frontmatter `related: [id|uid, …]`** expresses doc↔doc / doc→spec ties
  (schema + DTO + parser + generated `skill/schema`).
- **Orphan detection** additionally counts `related` (both directions, id/uid
  resolved) and **`sources` overlap** (docs describing the same code path), and the
  auto **project map draws doc↔doc edges** (`related` + a chained `source` edge) so
  connected docs are visible instead of hidden.
- **Skill contract** (`SKILL.md` / `AGENTS.md`): when authoring or adopting a
  project, trace each doc's real relationships and wire them; **completion target
  ≥90% of docs linked** (orphan rate < 10%), with the remainder being genuinely
  standalone — no fake links to pad the number.

## 1.2.14

**Map: smooth curved edges.** Diagram edges were drawn as `<polyline>`s through dagre's routed
waypoints, which kinked sharply at every bend. They now render as a Catmull-Rom → cubic-bezier
`<path>`, so edges curve gently through the same routing (straight line preserved for 2-point edges).

## 1.2.13

**UI redesign — Claude Design system imported.** Adopted the design authored in Claude Design
(`Manifast.dc.html`) across the whole SPA:

- **Theme system:** CSS-variable design tokens on a `#mf-root` wrapper — light + dark mode and
  four accent colors (indigo/emerald/orange/blue), Geist / Geist Mono fonts. Theme + accent persist
  to `localStorage`; theme defaults to the OS `prefers-color-scheme`.
- **Shell:** new header (view title + breadcrumb, Live status pill wired to the WS connection,
  Export, accent picker, light/dark toggle); sidebar simplified to a logo + 5-view nav + `.manifast/`
  footer.
- **Wireframes:** dot-grid canvas that tracks pan/zoom, restyled zoom/Fit cluster, and a bottom
  "Screens" thumbnail strip (the wireframe list moved out of the sidebar).
- **Docs:** a left rail (search + folder groups + status dots + archived toggle) beside the reading
  pane (the doc list moved out of the sidebar).
- **Tasks/Plan/Map + chrome** recolored to the tokens so dark mode + accents are coherent
  everywhere; the wireframe Renderer keeps its own inline styles (export fidelity) untouched.

## 1.2.12

**Ctrl+C no longer hangs.** The CLI's graceful shutdown waited on `app.close()`, which never
resolved while a browser held the live-reload WebSocket open. Now the server force-closes open WS
sockets (+ Fastify `forceCloseConnections`), and the CLI has a 2s force-exit fallback (a second
Ctrl+C exits immediately).

## 1.2.1

**Dogfood fixes** (after applying v4 to a real repo and evaluating the result):

- **Map: `path` refs are now navigable + freshness-aware.** Diagram nodes authored with
  `ref:{kind:"path", …}` used to render as dead boxes; the app now resolves them to the doc, so
  they click through and show staleness like `doc` refs.
- **`manifast init` upgrades existing projects.** It now refreshes the Manifast-managed skill
  (`SKILL.md`) and `.manifast/schema/*.json` when they differ (previously skipped), and refreshes
  a Manifast-generated root `AGENTS.md` — but never a user's own (gated on a marker).
- **Skill rules tightened:** a headless "apply vs defer" contract for Mode A (frontmatter/status/
  docmap safe to apply unattended; deletes/merges/body edits are proposal-only); require `sources`
  on *all* code-adjacent docs; specify `sources` granularity, huge-file head-reads, EOL
  preservation, and the `ref`/`edge.kind` conventions; sync the SKILL.md/AGENTS.md frontmatter
  example with the full v4 field set.
- **`manifast.json` documented + schema'd** (new `manifast.schema.json`).

## 1.2.0

**Document governance / 지속관리 (v4).** (See DESIGN 부록 D.)

- **Durable directive:** `manifast init` now merges a marker-delimited managed
  block (`<!-- manifast:begin -->…<!-- manifast:end -->`) into the project's
  `CLAUDE.md` and `AGENTS.md` so future agent sessions keep authoring docs via the
  skill. Text outside the markers is never touched; re-running updates only the
  block. A fresh `CLAUDE.md` imports `@AGENTS.md` (Claude Code reads `CLAUDE.md`,
  not `AGENTS.md`).
- **Skill — two modes + doc-type catalog:** SKILL.md/AGENTS.md now cover Mode A
  (structure an existing `docs/` pile) and Mode B (greenfield `spec → plan → tasks`),
  plus a first-class doc-type catalog (ADR, arc42/C4 architecture, Diátaxis) —
  supported, not mandated (the skill picks the right set per project).
- **Governance frontmatter:** docs gain optional `owner`, `lastReviewed`,
  `reviewBy` (review TTL in days), `sources` (code paths the doc describes), and
  `critical`. The `type` enum widens to include `adr`, `architecture`, and the
  Diátaxis four (`tutorial`/`howto`/`reference`/`explanation`).
- **Freshness (AI-free):** the server flags a doc **stale** when a `sources` file
  is newer (by day) than its review baseline, or its `reviewBy` TTL has elapsed —
  shown as a "Last reviewed by X on DATE" byline + `stale` badge in the doc view
  and an amber ring on map nodes. A **Review** button (`POST /api/doc/review`)
  re-blesses a doc (stamps `lastReviewed`), clearing the warning. The deep
  code↔doc drift judgement stays the agent's job (the app only compares mtimes).
- **Map — focus + filters:** click-to-focus a node's 1–N-hop neighborhood (depth
  slider), toggle edge kinds on/off, and an **orphans panel** listing link-less docs.
- **Skill — structuring playbook + drift:** SKILL.md/AGENTS.md gain a step-by-step
  playbook for ingesting an existing `docs/` pile (inventory → dedup → ROT →
  Diátaxis → IA → gap → migration, all proposed as drafts) and an ongoing
  freshness/drift routine. **ADR** is first-class (`docs/adr/NNNN-*.md`, immutable,
  status mapped onto draft/active/deprecated).
- **Map — stale panel:** a "검토 필요 N개" panel lists stale docs with reasons,
  alongside the orphans panel; stale doc nodes get an amber ring.

## 1.1.2

**Clarity / performance polish** (after dogfooding on a large real project):

- **Docs nav grouped by folder** (PRD / Specs / (root) / `docs/...`) with per-group
  counts and a **search box** — instead of one flat list of dozens of docs.
- **Map no longer a hairball:** the auto project map hides docs that have no links
  by default (toggle to show them), so it shows real structure (e.g. 12 nodes
  instead of 77). Edges + dagre layout unchanged.
- **Large-doc handling:** doc listing reads only the first 16KB (frontmatter +
  first H1) and caches meta by mtime — large docs (100KB+ logs) and live-reload
  stay fast.

## 1.1.1

**Critical fix — watcher stalled the server on big repos.**

- Root-level file sources (`CLAUDE.md` / `AGENTS.md` / `README.md`) were handed to
  chokidar, which then recursively watched the file's parent dir = the entire
  project root (`build/`, `data/`, … gigabytes). `/api/workspace` took 11–70s and
  the app sat on a blank "Loading…".
- Fix: directory sources go to chokidar (recursive); **file sources are watched
  individually with `fs.watch`** (non-recursive). `/api/workspace` → ~0.2s.

## 1.1.0

**Document management (v2) + Diagrams/Map (v3).** (See DESIGN 부록 B·C.)

- **Multi-source docs:** ingests `docs/` and root `CLAUDE.md`/`AGENTS.md`/`README.md`
  in addition to `.manifast/`. Plain `.md` (no frontmatter) is ingested leniently
  (title from first H1/filename, dates from the filesystem).
- **Lifecycle:** doc `status` extended to `deprecated`/`archived` + `createdAt`/
  `deprecatedAt`/`archivedAt`/`deprecatedBy`. Deprecated → strikethrough +
  successor chip; archived hidden behind a toggle (or via `docs/archive/`).
- **Stable `uid`:** an "Adopt" button stamps a random, app-managed `uid` into a
  doc's frontmatter so it's tracked across folder moves/renames. The app's only
  writes are doc frontmatter `uid` + status/metadata — never the body.
- **Diagrams:** generic `manifast.diagram/1` artifact (`.manifast/diagrams/*.json`:
  nodes/edges/groups). New **Map** view auto-lays-out with dagre. Plus an **auto
  project map** derived from existing links (no file needed). Node `ref` jumps to
  the linked item.

## 1.0.0

**Initial release.** Local CLI + server + SPA per `docs/DESIGN.md`.

- `manifast` (start + open), `manifast <dir>`, `manifast init` (scaffold + install
  skill, never overwrites), `--port`, `--no-open`.
- Fastify server: folder-convention discovery, zod validation, `/api/workspace`,
  `/api/file`, live reload over WebSocket (chokidar, debounced).
- React SPA, 4 views: **wireframes** (infinite canvas, pan/zoom 10–400%, 18-node
  low-fi catalog), **docs** (PRD/spec, GFM + highlighted code, frontmatter header),
  **tasks** (4-column kanban), **plan** (roadmap with progress). Bidirectional link
  chips; validation errors shown inline without blanking the screen.
- Export: wireframe PNG/SVG/HTML/JSON, doc MD/HTML, whole-workspace ZIP.
- zod schemas are the single source of truth → generate `skill/schema/*.json`.
