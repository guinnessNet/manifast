# CLAUDE.md — working on the Manifast codebase

This file orients an AI agent (or human) **working on Manifast's own source**.
It is NOT the end-user authoring guide — that lives in `skill/SKILL.md` /
`skill/AGENTS.md` and is what `manifast init` installs into *other* projects.

## What this repo is

Manifast is a **local, read-only web tool** that visualizes + live-reloads +
exports the files an external agent authors in a project's `.manifast/` folder
(wireframes, PRD/specs, task board, roadmap) plus, since v2/v3, the project's
`docs/` and node/edge **diagrams**. Personal, offline, no auth/DB, **no in-app
AI** (the agent analyzes; the app only renders).

- **User-facing docs:** `README.md`
- **Authoritative spec (v1) + change appendices:** `docs/DESIGN.md` (부록 B = v2 docs, 부록 C = v3 diagrams)
- **Version history:** `CHANGELOG.md`

## Commands

```bash
npm install
npm run dev        # Vite (:5173, HMR) + API/WS server (:4317), shell-free launcher (scripts/dev.mjs)
npm run build      # gen schema JSON → build SPA (dist/web) → bundle CLI (dist/cli) via esbuild
npm run typecheck  # tsc --noEmit (build does NOT typecheck — run this)
npm run check      # headless SSR smoke test of renderer + views (scripts/ssr-check.tsx)
npm start          # node dist/cli/index.js
```

`npm run dev` watches `skill/examples/.manifast` by default (`MANIFAST_DIR` overrides).

## Architecture (data flow)

```
.manifast/ + docs/ files  ──>  server (Fastify)  ──>  REST/WS  ──>  React SPA
  (single source of truth)     discover + zod-validate            7 views + live reload
```

- `src/shared/schema/*` — **zod schemas are the single source of truth.** They
  also generate `skill/schema/*.json` (agent contract) via `npm run gen:schema`.
- `src/shared/types.ts` — DTOs shared by server + web.
- `src/server/` — `workspace.ts` (discover + parse + validate → DTO; partial-read
  + mtime cache), `routes` in `index.ts` (`/api/workspace|file|files|raw`, POST
  `/api/doc/adopt|status`), `watcher.ts` (chokidar dirs + fs.watch files → WS),
  `edit.ts` (the ONLY writer: doc frontmatter uid/status only).
- `src/cli/` — `index.ts` (start/`<dir>`/`init`/flags, mri+open), `init.ts`
  (scaffold + managed guide/schema install/refresh; preserves user content).
- `src/web/` — Vite + React 19 + Tailwind v4. Views: `wireframe/` (canvas +
  18 inline-styled nodes + dagre-free pan/zoom), `docs/`, `tasks/`, `plan/`,
  `diagram/MapView` (dagre layout). `lib/` = api, links, graph (auto map), layout,
  export, cn, nav. Hooks: `useWorkspace`, `useLiveReload`, `useFile`.
- `skill/` — `SKILL.md`, `AGENTS.md`, generated `schema/`, `examples/` (dev/e2e demo workspace; not init-seeded).
- `scripts/` — `gen-schema.ts`, `build-server.ts` (esbuild), `dev.mjs`, `ssr-check.tsx`.

## Conventions

- TypeScript everywhere; `@shared/*` path alias → `src/shared`.
- **Wireframe nodes render with inline styles** so the same DOM powers the canvas
  AND PNG/SVG/HTML export — don't switch them to Tailwind classes.
- All API paths are **project-root-relative** (e.g. `.manifast/wireframes/x.json`,
  `docs/a.md`); resolution is confined to the project root.
- Minimal deps; shadcn-style components are hand-rolled (`cn` + cva), not the CLI.

## Hard constraints (and the intentional relaxation)

v1 was strictly read-only with `.manifast/` as the only source. **v2 deliberately
relaxed this for documents** (owner decision): the app may write **doc frontmatter
`uid` + status/metadata only — never the body**, and ingests `docs/` + root
`CLAUDE.md`/`AGENTS.md`/`README.md`. Wireframes/tasks/plan stay `.manifast/`-only
and read-only. Still **no in-app AI / MCP / DB / auth.** (See DESIGN 부록 B.)

## Gotchas (learned the hard way)

- **Watcher must NOT hand root-level file sources to chokidar** — chokidar then
  watches the file's parent dir = the whole repo (build/, data/, GBs) and stalls
  the server (was 11–70s). Root files are watched individually with `fs.watch`;
  only directories go to chokidar. (`watcher.ts`, `resolveWatchRoots`.)
- **chokidar v4 dropped glob support** — watch directories, filter in the handler.
- **Doc listing reads only the first 16KB** (head) + caches meta by mtime, so large
  docs (100KB+ logs) and live-reload stay fast.
- The auto **project map hides unlinked docs by default** (toggle to show) so it
  isn't a hairball; agent-authored diagrams live in `.manifast/diagrams/*.json`.
- Build does not typecheck; run `npm run typecheck` separately.

## Release / refresh

To ship changes: **bump `version` in package.json** → **update `README.md`
(version badge + any "what's new" content)** and add a `CHANGELOG.md` entry →
`npm run build`. Then either:

- **Publish to npm** — push a `v*` tag; the tag-gated CI job runs `prepublishOnly`
  (`check:readme && typecheck && check && test && build`) then `npm publish`. Or
  publish locally with `npm publish` after `npm login`.
- **Refresh the local global install** — `npm install -g .`. Installing the **same**
  version reports "up to date" and will NOT refresh — always bump first.

**Rule — README ships with every version bump.** `prepublishOnly` runs
`check:readme` (`scripts/check-readme-version.mjs`), which fails the publish if
the README `> vX.Y.Z ·` badge doesn't match `package.json`. So a version bump
that forgets the README can't publish. The npm page README is a publish-time
snapshot (its *images* hot-link to `main` and refresh on push, but the *text*
only syncs on republish) — keep them in lockstep by updating README in the same
release as the bump. If a code release lands without a README update, follow it
with a patch bump that syncs the README (e.g. 1.3.0 → 1.3.1).

## Verifying real behavior

`npm run check` covers SSR rendering. For real browser/perf checks, a headless
Chrome is driven via `puppeteer-core` (installed `--no-save`; npm installs prune
it, so reinstall when needed). Drive the running server, screenshot, inspect.
