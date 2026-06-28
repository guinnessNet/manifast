# Changelog

All notable changes to Manifast. Published on npm as
[`manifast`](https://www.npmjs.com/package/manifast) (`npm install -g manifast`).
Building from source? Bump the version, then `npm run build && npm install -g .`.

## 1.2.1 — `manifast validate` + LLM-agnostic guide + security hardening (2026-06-28)

- **New `manifast validate [dir]` command.** Re-parses the workspace through the
  same zod schemas the app uses and checks cross-references (broken
  spec→wireframe/tasks links, doc `related`/`deprecatedBy`, task
  `specId`/`wireframeId`/`deps`, plan `taskIds`, and diagram edge endpoints /
  `node.ref` — incl. `path` refs pointing at a file that must exist in-root —
  / `node.group`) plus duplicate ids, exiting non-zero on any error
  (`--strict` also fails on warnings). Each problem is reported once at the right
  level (schema failures = errors, inferrable doc-id clashes / frontmatter
  warnings = warnings). An **LLM-agnostic gate**: any agent can author the files,
  but bad output fails loudly instead of being silently ingested.
- **Authoring guide is now installed at an LLM-neutral path.** `manifast init`
  always writes the full guide to `.manifast/AGENTS.md` (previously only the
  root `AGENTS.md`, which is skipped when the project already has its own), and
  the durable directive points **every** agent there + tells it to run
  `manifast validate`. Fixes the case where a project's own `AGENTS.md` left
  Codex/other tools without the schema.
- **Security hardening.** File access resolves realpaths so a symlink/junction
  inside the workspace can't escape the project root — both on the read/write
  endpoints (`/api/raw`, `/api/file`, doc writes) and during workspace discovery
  — including the manifest read, the file-export listing, and the **watcher
  roots**, so even a `.manifast` directory that is itself a junction can't leak
  an outside project name / file names, get its external changes broadcast over
  the live-reload WS, or send the export walker into an outside tree. Every
  request must
  carry a local `Host` (DNS-rebinding defense, GET included) and state-changing
  POSTs / `/ws` upgrades a local `Origin` (CSRF). Bumped `@fastify/static` to
  `^9.1.3` (path-traversal advisories).

## 1.2.0 — user-flow & feature-tree views (2026-06-26)

- **New "User Flow" view.** Agent-authored `kind:"flow"` diagrams render as a
  dedicated, read-only user flow: typed nodes — `start`/`end` (green/red **pills**),
  `page` (clicks through to its wireframe via `ref`), `action`, `decision` — laid out
  top-down/left-right by dagre with **arrowed, labelled edges** (e.g. `예`/`아니오`).
  Lives in its own sidebar tab; no in-app editing — the agent authors the JSON, the app
  draws + live-reloads + exports.
- **New "Tree" view.** `kind:"tree"` hierarchy diagrams render top-down as a feature
  tree (`project → requirement → feature → detail`) with per-level node colors and the
  1–3 line intent in `node.description`. Its own sidebar tab.
- **Map view now has Export.** The diagram views (Map / User Flow / Tree) gain a
  PNG / SVG menu (+ raw JSON for an authored diagram) — the Map view previously had none.
- **Authoring contract:** `skill/SKILL.md` + `AGENTS.md` document the flow/tree recipes
  and conventional node kinds; seeded `examples/.manifast/diagrams/{user-flow,feature-tree}.json`.
- Internals: `MapView` gains a `mode` (`map`/`flow`/`tree`) that scopes the existing
  dagre renderer by diagram kind (`isFlowKind`/`isTreeKind` in `lib/layout.ts`) — one
  renderer, no duplication; `ssr-check` guards both new examples (parse + layout).

## 1.1.0 — collapsible docs folder tree (2026-06-26)

- **The Docs sidebar is now a collapsible folder tree.** The flat, full-path
  group headers are replaced by a nested folder hierarchy (like VS Code): each
  folder collapses/expands via a chevron (click · Enter · Space), carries a
  **recursive doc-count badge** (e.g. `claim 15`), and **모두 접기 / 모두 펼치기**
  collapse/expand the whole tree at once. Folders sort before files; the
  agent-authored `.manifast/prd` + `.manifast/specs` keep their PRD/Specs labels.
- **State persists.** Collapse/expand state is saved to `localStorage`
  (`mf-docs-collapsed`) so it survives a full refresh **and** live reload; the
  stored set self-prunes paths for folders that were renamed/deleted.
- **Search auto-expands.** Typing in the doc filter force-expands every folder
  containing a match; while searching, folder rows render as static headers so
  the auto-expand can't be silently toggled away behind the user's back.
- **Accessibility.** Folder toggles are real `<button>`s with `aria-expanded`, an
  `aria-label`, and a visible focus ring; count badges + collapse controls use the
  AA-contrast `--text-muted` token.
- Internals: a new pure `src/web/lib/docTree.ts` (`buildDocTree` / `allFolderPaths`
  / `folderLabel`) with unit tests + DocRail render tests. The Map view's separate
  “폴더로 집계” aggregation is unchanged — this is the **sidebar** tree.

## 1.0.1 — doc readability (2026-06-26)

- **Markdown body contrast:** `.mf-prose` body text now uses the full-strength
  `--text` token (was `--text-muted`, which read as washed-out gray). Secondary
  chrome (blockquote, table cells) stays muted.
- **WCAG AA gray tokens:** darkened `--text-muted`/`--text-faint` on both themes
  to clear ≥4.5:1 (light muted #52525b ~7:1, faint #6b6b76 ~4.8:1; dark muted
  #9a9aa4 ~6.6:1, faint #7a7a84 ~4.6:1). Body size 14.5px→15px.
- **Korean font stack:** lead with Pretendard and keep explicit Hangul fallbacks
  (Apple SD Gothic Neo / Malgun Gothic / Noto Sans KR) so 한글 no longer falls
  back to bare `system-ui`.

## 1.0.0 — first public release (2026-06-26)

The first npm-ready release. Pre-publish hardening on top of the 1.2.x
line (see the note below the 1.2.x entries); no user-facing behavior change versus
1.2.15 — this is the trust/packaging milestone, not a feature drop.

- **Packaging:** MIT `LICENSE` + `license` field; `repository`/`homepage`/`bugs`/
  `author`/`keywords`; `publishConfig.access=public`; a `prepublishOnly` gate
  (`typecheck && check && test && build`) so `npm publish` can't ship stale/untested output.
- **Test suite (vitest):** 100 unit + integration tests covering the zod schemas,
  the 1.2.15 graph logic (`graph.ts`: orphans, `related` both directions, id/uid
  resolution, `sources` overlap, doc↔doc + chained source edges, no self/dupe edges),
  `links.ts`, `layout.ts`, the extracted `smoothPath` curve, `workspace.ts`
  (parse/inferDocType/slug/16KB head/mtime cache), the **only writer** `edit.ts`
  (uid + status only, body + EOL preserved, idempotent) through `POST /api/doc/*`,
  the REST API via `app.inject()`, **path-traversal confinement (P0 security)**,
  the watcher's dir-vs-file split, and the graceful-shutdown force-close.
- **Refactors (internal, no behavior change):** `smoothPath` extracted to a pure
  module (`src/web/lib/smoothPath.ts`); `buildApp()` split out of `createServer()`
  so the server can be driven headlessly in tests.
- **E2E (Playwright):** drives the built SPA (`dist/web`) served by the real CLI —
  boot + live pill, switch all 5 views, theme + accent persist across reload,
  canvas zoom/Fit, `.zip` export download, Map bezier edges, and live-reload of a
  new doc. The e2e workspace lifecycle is owned by `global-setup.ts` for clean
  cross-platform teardown.
- **CI (GitHub Actions):** matrix Node 20/22 × ubuntu/windows → typecheck →
  schema-drift guard → test → build → SSR check → `npm pack --dry-run`; a separate
  Linux e2e job; and a tag-gated `npm publish --access public` job (runs `prepublishOnly`).
- **`.gitattributes`** pins LF so the schema-drift `git diff` guard is deterministic
  across OSes.
- **Perf smoke:** a test parses 300+ docs incl. a ~200KB one and re-reads from the
  mtime cache, guarding the head-16KB + cache fast-path.
- **a11y guards (e2e):** key controls expose accessible names, the theme toggle is
  keyboard-operable, and Tab reaches interactive controls.

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

> **Note on the 1.2.1 → 1.2.12 jump:** versions 1.2.2–1.2.11 were local,
> unreleased iterations whose changes were folded into the 1.2.12+ entries above.
> The history is intentionally continuous from 1.2.12 onward.

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
