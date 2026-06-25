# Contributing to Manifast

Thanks for your interest! Manifast is a **local, offline, personal** tool — no
auth, no DB, no cloud, **no in-app AI**. The agent authors content; the app only
renders it and (narrowly) writes doc frontmatter. Please keep changes within that
boundary (see `CLAUDE.md` → *Hard constraints*).

## Getting started

```bash
npm install
npm run dev        # Vite (:5173) + API/WS server (:4317), watches skill/examples/.manifast
```

`MANIFAST_DIR=/path/to/project npm run dev` points the dev server at another
workspace.

## The golden path before any PR

```bash
npm run typecheck   # tsc --noEmit (the build does NOT typecheck)
npm test            # vitest: schema, graph/links, workspace, edit, security, watcher…
npm run build       # gen:schema → SPA (dist/web) → CLI (dist/cli)
npm run check       # headless SSR smoke of the renderer + views
npm run test:e2e    # Playwright against the built app (needs `npm run build` first)
```

CI runs all of these on Node 20 + 22 × Ubuntu + Windows, plus a schema-drift
guard. A PR should be green locally first.

## Conventions

- **TypeScript everywhere**; `@shared/*` → `src/shared`.
- **zod schemas (`src/shared/schema/*`) are the single source of truth.** After
  changing one, run `npm run gen:schema` and commit the regenerated
  `skill/schema/*.json` — **never hand-edit the generated JSON.** A CI guard fails
  on drift.
- **Wireframe nodes render with inline styles** (the same DOM powers PNG/SVG/HTML
  export) — don't convert them to Tailwind classes.
- The server is the **only** writer, and only for doc frontmatter `uid` +
  status/metadata — never the document body, never wireframes/tasks/plan.
- Keep dependencies minimal; UI primitives are hand-rolled (`cn` + cva).

## Tests

- Unit/integration: **vitest** under `test/` (`*.test.ts[x]`). DOM tests opt into
  jsdom with a `// @vitest-environment jsdom` docblock.
- E2E: **Playwright** under `test/e2e/` (`*.spec.ts`), driving the built app.
- Add a regression test alongside any bug fix.

## Commit / PR

- Small, focused commits with clear messages.
- Update `CHANGELOG.md` for any user-visible change and follow the release process
  in `CLAUDE.md` (bump `package.json` version → build → reinstall) when relevant.

## Versioning (semver)

Manifast follows [Semantic Versioning](https://semver.org):

- **patch** — bug fixes, docs, internal refactors with no behavior change.
- **minor** — backward-compatible features (a new view, a new optional schema
  field, a new CLI flag).
- **major** — breaking changes to the **agent-facing contract** (`skill/schema/*`,
  required frontmatter, file conventions) or to the CLI/REST surface.

The zod schemas in `src/shared/schema/*` are the contract; a change that makes a
previously-valid `.manifast/` file invalid is a major bump.
