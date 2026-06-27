---
schema: manifast.doc/1
id: public-release-audit
type: doc
title: Manifast Public Release Audit
status: active
owner: kjh
updatedAt: 2026-06-28
---

# Manifast Public Release Audit

Audit date: 2026-06-28

Scope: independent pre-publication audit for npm publish and public GitHub
release readiness. No code or content was modified during the audit.

## Executive Verdict

| Surface | Verdict | Evidence |
|---|---|---|
| npm tarball | Conditionally publishable, but hold recommended | `npm pack --dry-run --json`: 34 files, 307 KB packed. Includes `dist`, `skill`, plus npm auto-included `README.md`, `LICENSE`, `package.json`. |
| Public GitHub repository | Hold before publishing | Tracked stale/internal docs and local absolute path references: `docs/PRODUCTION_READINESS.md:3`, `docs/DESIGN.md:409`, `CLAUDE.md:18`. |
| Verification | Passing | `npm run typecheck`, `npm test` (129 passed), and `npm run check` all passed. |

Overall: npm runtime packaging is close, but the repository should not be made
public as-is. The main risks are stale public-facing documents, version drift,
and small hygiene issues.

## 1. npm Eligibility

| Check | Risk | Finding |
|---|---|---|
| package metadata | Irrelevant | Required fields exist: `license`, `homepage`, `repository`, `bugs`, `bin`, `files`, `engines`, `publishConfig`, `prepublishOnly` in `package.json:6`, `package.json:8`, `package.json:9`, `package.json:13`, `package.json:33`, `package.json:36`, `package.json:40`, `package.json:43`, `package.json:59`. |
| LICENSE | Irrelevant | MIT license exists with `Copyright (c) 2026 kjh` at `LICENSE:3`. |
| CLI shebang | Irrelevant | `dist/cli/index.js:1` is `#!/usr/bin/env node`; `node dist/cli/index.js --version` returned `1.2.0`. |
| npm included files | Irrelevant | Dry-run tarball includes built CLI/web assets, `skill/*`, `README.md`, `LICENSE`, and `package.json`; it does not include source, tests, `docs/`, `.manifast/`, or `.claude/`. |
| README screenshots | Fix before public release | README references `docs/screenshots/*.png` at `README.md:21`, `README.md:25`, `README.md:27`, but `docs/screenshots` is not in the npm tarball. npm page images may break. |
| read-only messaging | Fix before public release | README says the app never writes files except `init` at `README.md:14`, but later documents doc frontmatter writes at `README.md:153`. |
| version consistency | Fix before public release | `package.json:3`, `README.md:5`, and latest `CHANGELOG.md:7` say `1.2.0`; `package-lock.json:3` and `package-lock.json:9` say `1.2.15`. |
| publish/provenance messaging | Fix before public release | CHANGELOG says tag-gated `npm publish --provenance` at `CHANGELOG.md:86`; workflow uses `npm publish --access public` and notes provenance still needs public repo/id-token setup at `.github/workflows/ci.yml:83`-`88`. |

## 2. Tracked Markdown Review

| File | Decision | Risk | Evidence |
|---|---:|---|---|
| `.claude/skills/manifast/SKILL.md` | REMOVE | Fix before public release | Installed/older skill copy whose scope differs from canonical `skill/SKILL.md`; see `.claude/skills/manifast/SKILL.md:3`. |
| `.manifast/prd/prd.md` | KEEP | Irrelevant | Demo PRD. `password` occurrence is example code, not a secret: `.manifast/prd/prd.md:37`. |
| `.manifast/specs/feat-auth.md` | KEEP | Irrelevant | Demo spec: `.manifast/specs/feat-auth.md:3`. |
| `.manifast/specs/feat-dashboard.md` | KEEP | Irrelevant | Demo spec: `.manifast/specs/feat-dashboard.md:3`. |
| `AGENTS.md` | KEEP | Irrelevant | Source repo agent guide: `AGENTS.md:1`. |
| `CHANGELOG.md` | TRIM | Fix before public release | Public changelog contains internal/dogfood wording: `CHANGELOG.md:61`, `CHANGELOG.md:150`, `CHANGELOG.md:201`. |
| `CLAUDE.md` | TRIM | Fix before public release | References missing historical prompt and local-global release flow: `CLAUDE.md:18`, `CLAUDE.md:88`. |
| `CONTRIBUTING.md` | KEEP | Irrelevant | Public contribution guide: `CONTRIBUTING.md:1`. |
| `README.md` | TRIM | Fix before public release | Read-only contradiction and npm-missing images: `README.md:14`, `README.md:21`, `README.md:153`. |
| `docs/DESIGN.md` | TRIM | Fix before public release | Internal absolute path and missing prompt reference: `docs/DESIGN.md:409`, `docs/DESIGN.md:439`. |
| `docs/PRODUCTION_READINESS.md` | REMOVE | Public blocker | Stale audit says "NOT publish-ready" and lists now-false blockers such as no git/license: `docs/PRODUCTION_READINESS.md:3`, `docs/PRODUCTION_READINESS.md:14`. |
| `skill/AGENTS.md` | KEEP | Irrelevant | End-user authoring guide: `skill/AGENTS.md:1`. |
| `skill/CHECKLIST.md` | KEEP | Irrelevant | Product skill document; `todo` is a task status value: `skill/CHECKLIST.md:17`. |
| `skill/SKILL.md` | KEEP | Irrelevant | Canonical skill: `skill/SKILL.md:1`. |
| `skill/WORKFLOW.md` | KEEP | Irrelevant | Public workflow skill; prompt structure is product behavior: `skill/WORKFLOW.md:198`. |
| `skill/examples/**/*.md` | KEEP | Irrelevant | Seed/demo content: `skill/examples/.manifast/prd/prd.md:3`, `skill/examples/docs/architecture.md:1`. |
| `skill/skills/*/SKILL.md` | KEEP | Irrelevant | Installed workflow subskills: `skill/skills/brainstorm/SKILL.md:1`, `skill/skills/implement/SKILL.md:1`, `skill/skills/write-plan/SKILL.md:1`. |

## 3. Dead Code and Dependencies

| Candidate | Confidence | Risk | Evidence |
|---|---:|---|---|
| `src/web/components/ui/card.tsx` unreferenced file | HIGH | Fix before public release | `Card` is defined at `src/web/components/ui/card.tsx:4`; no import/use was found. |
| unused `Badge` import | HIGH | Fix before public release | `tsc --noUnusedLocals` reported it; import is at `src/web/components/tasks/Board.tsx:6`. |
| unused `React` import in SSR script | HIGH | Fix before public release | `tsc --noUnusedLocals` reported it; import is at `scripts/ssr-check.tsx:1`. |
| schema constituent exports | LOW | Irrelevant | Exports such as `DiagramRefSchema` and `TaskSchema` are used for same-file schema composition even when not imported elsewhere; examples: `src/shared/schema/diagram.ts:6`, `src/shared/schema/tasks.ts:9`. |
| `src/cli/index.ts`, `src/server/standalone.ts` flagged by knip | HIGH false positive | Irrelevant | They are entrypoints via `package.json:34` and `scripts/dev.mjs:19`. |
| runtime dependencies | HIGH | Irrelevant | Runtime deps are imported by source: examples include `src/server/index.ts:1`-`3`, `src/cli/index.ts:1`, `src/cli/index.ts:5`. |
| unlisted `ws` test dependency | HIGH | Fix before public release | Test imports `ws` at `test/shutdown.test.ts:3`; `package.json` does not list `ws` directly. |
| console/debugger/TODO | HIGH | Irrelevant | No `debugger`, `console.debug/trace/dir`, or `TODO/FIXME/HACK` in `src/`; `console.log` occurrences are CLI/dev output such as `src/cli/index.ts:44` and `src/server/standalone.ts:22`. |
| unreachable code/commented blocks | HIGH | Irrelevant | `npx tsc --noEmit --allowUnreachableCode false` passed; no large commented-out code blocks were found. |

## 4. Git History, Secrets, Large Files, Identity

| Check | Risk | Evidence |
|---|---|---|
| commit messages | Fix before public release | No WIP/temp/profanity messages found. One public-history concern: commit `ffff064` says `Release prep: bump to 1.0.0 (first public release), keep repo private`. |
| author consistency | Irrelevant | 19 commits are all `kjh <kjh@maipharm.com>`. |
| placeholder author | Irrelevant | No `you@example.com`, `noreply`, or `unknown` style placeholder author was found. |
| remote/package URL consistency | Irrelevant | Git remote is `https://github.com/guinnessNet/manifast.git`, matching `package.json:8` and `package.json:11`. |
| author/license identity | Fix before public release | Package/git author uses company-domain email `kjh@maipharm.com` at `package.json:7`; LICENSE says `kjh` at `LICENSE:3`. Confirm public identity and ownership intent. |
| secrets | Irrelevant | No actual key/token files or literal credentials found. CI secret reference is expected: `.github/workflows/ci.yml:88`. `password` hits are UI field/example-code false positives. |
| large tracked files | Irrelevant | No tracked file exceeds 1 MB. Largest files are `package-lock.json` 312 KB and screenshots up to 290 KB. |

## Final npm Verdict

npm registration is conditionally possible, but publishing should be held until
the public-facing documentation and version drift are corrected.

## Required Pre-Publication Checklist

- Sync `package-lock.json` root version to `1.2.0`.
- Remove or fully rewrite `docs/PRODUCTION_READINESS.md` for the current state.
- Fix the `README.md` read-only/write-back contradiction.
- Ensure README screenshots render on npm by including `docs/screenshots` in
  `files` or switching to absolute public image URLs.
- Remove local path and missing prompt references from `docs/DESIGN.md`.
- Remove `.claude/skills/manifast/SKILL.md` from the public repo or sync it with
  canonical `skill/SKILL.md`.
- Confirm whether `kjh@maipharm.com` should be public; adjust package/git identity
  if needed.
- Add `ws` as a direct devDependency or change the test to avoid transitive
  dependency reliance.
- Remove `src/web/components/ui/card.tsx` or start using it; remove the two unused
  imports.
- Align CI publish/provenance wording and actual workflow behavior.
