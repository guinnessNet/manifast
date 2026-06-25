# Manifast — npm / production readiness

Snapshot @ **v1.2.15**. Honest verdict: **functional local tool, NOT publish-ready.**
The core works (5 views render in light/dark, builds, dogfooded on real repos), and
packaging hygiene is partway there — but it has no source-control/license, no real
test suite, and a just-landed UI redesign that hasn't been hardened. This doc lists
the **blockers** (what to fix) and a concrete **test plan** (what to write).

> Scope note: Manifast is deliberately a *personal, local, no-auth, no-DB, no-cloud,
> no-in-app-AI* tool. "Production" here means **"a stranger can `npx`/install it and it
> just works, with docs/license/tests/CI"** — not "multi-tenant SaaS."

---

## Facts checked (2026-06-25)

| Check | Result |
|---|---|
| git repository | ❌ **not a git repo** (no `.git`, no remote) |
| LICENSE / `license` field | ❌ none |
| CLI shebang (`dist/cli/index.js`) | ✅ `#!/usr/bin/env node` present (esbuild banner) |
| `npm pack --dry-run` | ✅ works — 31 files, 300 kB packed / 995 kB unpacked, `files:[dist,skill]` |
| `prepublishOnly` | ❌ none → publishing can ship **stale/missing `dist/`** |
| `repository`/`homepage`/`bugs`/`author`/`keywords` | ❌ none |
| Tests | ⚠️ only `typecheck` + `scripts/ssr-check.tsx` (SSR smoke). No unit/integration/e2e, no CI |
| Server bind | ✅ `127.0.0.1` only (good for a local tool) |

---

## 1. Blockers — P0 (do not `npm publish` without these)

1. **No git repo / remote.** There's nothing to clone, no issue tracker, no provenance.
   → `git init`, push to GitHub, add `repository`/`homepage`/`bugs` to `package.json`.
   (Also unblocks the README "clone" story and CONTRIBUTING.)
2. **No license.** Legally ambiguous for redistribution; npm warns.
   → Add `LICENSE` (MIT is the obvious fit) + `"license": "MIT"`.
3. **No `prepublishOnly`.** `npm publish` ships whatever is in `dist/` at the moment —
   easy to publish stale or unbuilt output.
   → `"prepublishOnly": "npm run typecheck && npm run check && npm test && npm run build"`.
4. **No automated test suite + no CI.** A read-only file server + parser with zero
   regression coverage is the real risk, especially after the 1.2.13 redesign and the
   1.2.15 graph changes. → See §4 + §5.
5. **Security: path-traversal coverage = 0.** The server resolves user-supplied paths
   (`/api/file?path=…`, `/api/raw`) under the project root. This is the main attack
   surface for a localhost server. There must be tests proving `../`, absolute paths,
   and symlink escapes are rejected/confined. (Code intends confinement — prove it.)
6. **README install accuracy.** ✅ Fixed in this pass (was `npx manifast`, which 404s
   since the package isn't on npm; now documents `npm install -g .`).

## 2. P1 — needed before calling it "production"

- **Cross-platform CI** (GitHub Actions): Node 20 + 22 × ubuntu + windows. Windows path
  handling (`toPosix`) and the watcher behavior are genuinely OS-sensitive.
- **E2E smoke (Playwright):** formalize the ad-hoc puppeteer screenshots into asserted
  tests — boot, switch all 5 views, theme/accent persist, pan/zoom, export, live-reload.
- **Schema-drift guard:** CI runs `npm run gen:schema` then `git diff --exit-code` so
  `skill/schema/*.json` can never drift from the zod source.
- **Dependency/bundle audit:** confirm what the published tarball actually needs at
  install time. `dist/cli` is esbuild-bundled and `dist/web` is prebuilt — verify
  whether the listed `dependencies` are bundled (then they bloat install for nothing)
  or required at runtime. Right-size `dependencies` vs `devDependencies`.
- **Empty / error-state UX:** first-run with no `.manifast/`, empty views, invalid
  JSON, huge docs — should guide the user, not show a blank pane.

## 3. P2 — polish before a 1.0 / wide release

- Visual-regression snapshots (Playwright) for the 5 views × light/dark × an accent.
- a11y pass (keyboard nav, focus rings, aria, color contrast in both themes).
- Perf smoke on a large workspace (100s of docs) — head-16KB + mtime cache should hold.
- README screenshots / GIF (npm page is bare without them).
- `CONTRIBUTING.md`, an explicit **semver policy**, and CHANGELOG continuity
  (it currently jumps 1.2.1 → 1.2.12).
- `npm pack` content review each release (don't ship `skill/examples` bloat you don't need).

---

## 4. Test plan

**Tooling:** `vitest` (unit + integration; native to a Vite project), Fastify
`app.inject()` for API tests (no real sockets), `@testing-library/react` + `jsdom` for
components, `@playwright/test` for e2e against the built app. Put fixtures under
`test/fixtures/.manifast/`.

### 4.1 Unit — schemas & pure logic (highest ROI, fastest)
- **`src/shared/schema/*`** — valid + invalid fixtures per type; discriminated-union
  rejection, defaults applied, the new `related` + `sources` fields parse. Wireframe
  recursive `Box.children`, 18-node catalog completeness (`NODE_TYPES`).
- **`src/web/lib/graph.ts`** *(changed in 1.2.15 — prioritize)* —
  `linkedDocIds`: `related` counts both directions, resolves by `id` **and** `uid`,
  `sources` overlap links docs, a lone doc isn't falsely linked;
  `getOrphanDocs`: orphan ⇔ no in/out link;
  `buildProjectMap`: doc↔doc `related` edges + chained `source` edges, no self-edge,
  no duplicate edge, hidden-vs-shown unlinked docs;
  `getNeighborhood`, `filterDiagram`.
- **`src/web/lib/links.ts`** — `buildLinkGraph`, `specsForWireframe`, `tasksForSpec`,
  broken-link greying.
- **`src/web/lib/layout.ts`** — dagre output shape, `direction` (TB/LR/…), node/edge points.
- **`MapView.smoothPath`** — 2 points → straight `L`; n points → bezier `C` chain;
  endpoints preserved (extract it to a pure module to test).
- **`src/cli/init.ts`** — never overwrites user files; refreshes *managed* skill/schema
  when they differ; idempotent on re-run.
- **`src/server/workspace.ts`** — frontmatter parse (`related`/`sources`/unquoted dates
  → string), `inferDocType`, slug-from-path, head-16KB truncation, mtime cache hit/miss,
  archived-by-path inference.

### 4.2 Integration — server / API (`app.inject`)
- `/api/workspace` DTO shape against a fixture; `/api/file`, `/api/files`, `/api/raw`.
- **`edit.ts` (the only writer)** via `POST /api/doc/adopt|status|review`: writes `uid`
  + status/metadata **only**, never the body; **EOL preserved**; idempotent.
- **Path traversal (P0 security):** `../`, absolute paths, encoded `..%2f`, and symlink
  escape all rejected / confined to project root.
- Invalid JSON / missing file / unknown path → correct 4xx, app keeps serving others.

### 4.3 Watcher (`src/server/watcher.ts`)
- **Regression guard for the documented gotcha:** `resolveWatchRoots` must hand only
  *directories* to chokidar and watch *root-level files* individually via `fs.watch` —
  never a root file's parent dir (that watched the whole repo and stalled the server).
- `classifyPath` mapping; a file change produces the expected WS message kind.

### 4.4 Shutdown (the 1.2.12 fix — regression guard)
- Open a `/ws` client, call `server.close()`, assert it resolves within ~1s
  (force-closes the socket) instead of hanging.

### 4.5 Component / render (jsdom)
- `ScreenRenderer`: every one of the 18 node types renders (promote `ssr-check` asserts).
- `Board` / `Roadmap` / `DocView` / `MapView` with fixtures, incl. `data-theme="dark"`.
- Theme/accent: `#mf-root` gets `data-theme`/`data-accent`; `localStorage` persists;
  OS `prefers-color-scheme` default.

### 4.6 E2E (Playwright, against `npm run build` output)
- Boot → switch all 5 views; theme toggle + accent change **persist across reload**;
  canvas pan / zoom / Fit; Export downloads a file (PNG + `.zip`); **live-reload**
  (write a fixture file → matching view updates < ~1s); Map shows smooth (bezier) edges
  and the orphan count.

### 4.7 Contract / drift
- `gen:schema` then `git diff --exit-code` (skill schema in sync with zod).
- The shipped `skill/examples/.manifast` validates against the schemas.

### 4.8 Cross-platform
- Run unit + integration on windows + ubuntu; explicit `toPosix` / path tests.

---

## 5. CI outline (GitHub Actions)

```
matrix: node [20, 22] × os [ubuntu-latest, windows-latest]
steps: install → typecheck → gen:schema && git diff --exit-code
       → test (vitest) → build → check (ssr) → npm pack --dry-run
e2e job: ubuntu, node 22 → build → playwright test
publish job: on tag v*, after green → npm publish --provenance (prepublishOnly builds)
```

## 6. `package.json` changes for publish

- add `license`, `repository`, `homepage`, `bugs`, `author`, `keywords`.
- add `"prepublishOnly": "npm run typecheck && npm run check && npm test && npm run build"`.
- add `"test": "vitest run"` (+ `"test:e2e": "playwright test"`).
- keep `engines.node >=20`; consider `"publishConfig": { "access": "public" }`.
- re-check `files` after the dep audit (ship `dist` + `skill`, trim unused examples).

---

## 7. Phased roadmap

- **Phase 0 — shareable (½ day).** git init + GitHub remote, LICENSE, package meta,
  `prepublishOnly`, README (done). → installable via clone, has a home.
- **Phase 1 — trustworthy (2–3 days).** vitest; §4.1 + §4.2 (incl. path-traversal) +
  §4.3 + §4.4; CI green on ubuntu. → safe to refactor, regressions caught.
- **Phase 2 — publish candidate (2–3 days).** Playwright e2e (§4.6), component tests
  (§4.5), schema-drift guard, cross-platform CI, dep/bundle audit.
- **Phase 3 — 1.0 + npm.** a11y, visual regression, screenshots/GIF, CONTRIBUTING,
  semver policy → `npm publish`.

## 8. Definition of done (npm publish)

- [ ] git repo + remote + `repository`/`bugs`/`homepage`
- [ ] LICENSE + `license` field
- [ ] `prepublishOnly` builds; `npm pack --dry-run` contents verified
- [ ] CLI bin works from a fresh global install on win + linux (shebang ✅)
- [ ] vitest suite green (schema, graph/links, workspace, edit, **path-traversal**, watcher, shutdown)
- [ ] Playwright e2e green (5 views, theme, live-reload, export)
- [ ] schema-drift guard in CI
- [ ] CI matrix green (node 20/22 × ubuntu/windows)
- [ ] README accurate (✅) + screenshots + CHANGELOG current
