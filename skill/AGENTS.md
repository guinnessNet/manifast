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

## 0. 두 작업 모드

**모드 A — 기존 문서 구조화** (프로젝트에 `docs/`가 이미 쌓여 있을 때). 흩어진 문서를 읽고
구조화해 Manifast가 시각화하게 만든다. **한 번에 다 바꾸지 말고 제안 → 사용자 확인**으로 진행한다
(앱은 본문을 쓰지 않는다 — 네가 유일한 저자다).
1. **인벤토리**: `docs/`와 루트 `CLAUDE.md`/`AGENTS.md`/`README.md`를 훑어 목록을 만든다.
2. **타입 분류**: 각 문서를 아래 *문서 타입 카탈로그*로 분류한다.
3. **매핑**: 기획/설계 문서는 `.manifast/`(prd·specs) 또는 추적 대상 `docs/`에 규칙대로 정리하고
   frontmatter를 채운다. 코드·문서 관계는 다이어그램(§5b)으로 그린다.
(중복 제거·ROT·IA 제안까지 하는 체계적 절차는 아래 *구조화 플레이북*을 따른다.)

**모드 B — 신규 생성** (새 프로젝트/기능). `spec → plan → tasks` 스파인으로 만든다: 기능 스펙
(`specs/<id>.md`) → 로드맵(`plan/plan.json`) → 태스크(`tasks/tasks.json`), 화면이 필요하면
와이어프레임. 링크(§6)로 연결한다.

두 모드 공통: **프로젝트 성격에 맞는 정본 문서 세트만** 만든다(작은 프로젝트에 모든 타입 강제 금지).

## 문서 타입 카탈로그 (first-class — 단, 의무 아님)

frontmatter `type`으로 구분하고, 필요한 것만 쓴다.

| type | 무엇 | 어디 | 언제 |
|---|---|---|---|
| `prd` | 제품 요구 | `.manifast/prd/` | 제품/제안 단계 |
| `spec` | 기능 명세 | `.manifast/specs/<id>.md` | 기능마다 |
| `doc` | 일반 설명/노트 | `docs/` | 그 외 설명 문서 |
| `adr` | 아키텍처 결정 기록 | `docs/adr/NNNN-*.md` | 되돌리기 어려운 결정 |
| `architecture` | 아키텍처 개요(arc42) | `docs/architecture/` | 시스템 구조 설명 |
| `tutorial`·`howto`·`reference`·`explanation` | Diátaxis 4타입 | `docs/<type>/` | 유저 대상 문서가 있을 때 |
| `plan` | 구현 계획 (스프린트/단계별) | `docs/plans/` | 실행 단계마다 |
| `results` | 완료 보고·Exit 판정 | `docs/` | 단계·마일스톤 완료 후 |
| `handoff` | 작업 핸드오프 (LLM/에이전트) | `docs/` | 에이전트 간 인계 시 |
| `prompt` | 재사용 LLM 프롬프트 정본 | `docs/prompts/` | 프롬프트 버전 관리 시 |

- **ADR**: 1결정 1파일, **불변**. 결정을 바꾸려면 고치지 말고 새 ADR을 만들어 옛 것을
  `status: deprecated` + `deprecatedBy: <새 ADR>`로 잇는다(상태 매핑: proposed→`draft`,
  accepted→`active`, superseded→`deprecated`).
- **arc42 + C4**: 아키텍처 *문서*는 arc42 섹션(필요분만), *그림*은 다이어그램(§5b)의
  `kind: "architecture"`로 C4 L1(Context)/L2(Container)만. L4(코드)까지 손으로 그리지 말 것.
- **Diátaxis**: 한 페이지에 타입을 섞지 말 것(학습=tutorial, 작업=howto, 사실=reference, 이유=explanation).
- 작은 프로젝트는 `prd`/`spec`/`doc` + 태스크/플랜이면 충분하다. **타입을 늘리는 게 목적이 아니다.**

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

**`id` 규칙**: `kebab-case`, 프로젝트 내 Manifast 문서 전체에서 **유니크**, 파일명 stem 권장
(예: `feat-auth.md` → `id: feat-auth`). 다이어그램 `node.ref.id`나 task `specId`에서 참조된 후에는
**stable** — 바꿀 때는 모든 참조(다이어그램·태스크·플랜)를 함께 수정해야 한다.

**루트 파일 (`CLAUDE.md`·`AGENTS.md`·`README.md`)**: Manifast가 인제스트하지만 Manifast
frontmatter를 **추가하지 않는다**. `CLAUDE.md`/`AGENTS.md`는 AI 지시 파일이므로 Manifast lifecycle
밖이다. `README.md`는 필요 시 frontmatter를 추가해도 무방하나 의무 아님. 다이어그램에서 참조할 때는
`{ kind: "path", id: "CLAUDE.md" }` 형태를 쓴다(frontmatter `id` 없으므로 `doc` ref 금지).

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
`node.kind` tints the box; `edge.kind`는 자유 형식이지만 권장 어휘를 우선 사용하고 맞는 게 없으면
`other`를 쓴다: `implements` · `supersedes` · `references` · `plans-for` · `results` · `includes` ·
`uses` · `produces` · `rollup` · `absorbed-by` · `next` · `sibling`. `node.ref` makes a node
clickable + freshness-aware: prefer `{kind:"doc", id}` for a tracked doc (or
`{kind:"wireframe"|"task", id}`); for a doc/file without a frontmatter `id` use
`{kind:"path", id:"<repo-relative path>"}` — the app resolves it to the doc so it still
clicks and shows staleness. Don't leave half the nodes edgeless — add relates/supersedes
edges or rely on groups. Manifast also shows an auto project map (links) with no file needed.

Pick `kind`/`layout` to match the shape: `flow`/`userflow` → directional **user flow** (its own
**User Flow** tab) with typed nodes `start|end` (pills) · `page` (add `ref:{kind:"wireframe",id}`) ·
`action` · `decision`, and **labelled** edges (`"예"`/`"아니오"`); `tree`/`sitemap` → top-down
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

## 구조화 플레이북 (모드 A 상세 — 기존 더미 정리)

기존 `docs/` 더미를 구조화할 때 따른다. 한 번에 다 하지 말고 단계별로 결과를 보여준다.

**자율 적용 vs 보류 (헤드리스에서도 명확):** 사람 확인을 못 받는 배치/헤드리스에서도 아래 "안전"은
바로 적용하고, "보류"는 적용하지 말고 목록으로 보고한다.
- **안전(바로 적용)**: frontmatter 추가/수정(id/type/title/status/owner/sources/reviewBy/lastReviewed),
  `status: deprecated|archived` 설정(가역), docmap 다이어그램 생성/갱신.
- **보류(제안만·보고)**: 파일 삭제·병합·이동, 본문(markdown body) 편집. (앱도 본문은 절대 안 쓴다 —
  구조화는 frontmatter·새 파일로만 표현한다.)

0. **사전 백업**: 작업 시작 전 현재 상태를 `backup/pre-manifast-<YYYY-MM-DD>` 브랜치로 커밋해 둔다.
   결과가 마음에 안 들면 이 브랜치로 되돌릴 수 있다. 이미 별도 작업 브랜치에 있으면 생략 가능.
1. **인벤토리(읽기전용)**: 모든 문서를 표로 — 경로 · 제목(첫 H1) · 최종수정 · 대략 분량 · 잠정 타입.
2. **요약 + 메타**: 문서마다 짧은 요약과 메타(타입·주제·`owner` 후보)를 frontmatter 스키마(§3)에
   맞춰 제안.
3. **중복 제거**: 겹치는 쌍을 duplicate(병합) / variant(맥락 달라 유지) / **conflict(모순 — 사람에게
   질문)** 로 분류. duplicate는 정본 1개 + 나머지는 `deprecated`(`deprecatedBy`로 정본 가리킴).
4. **ROT 분류**: Redundant / Outdated / Trivial 를 계산 가능한 신호(중복·오래됨·깨진 링크·없어진
   `sources` 심볼)로 추려 keep / update / merge / archive / **delete** 제안. **삭제 질문을 먼저** 한다
   (삭제면 나머지 편집 질문이 무의미). 절대 임의 삭제 금지.
5. **타입 분류(Diátaxis)**: 각 문서를 카탈로그 타입으로 태깅하고, 한 페이지에 타입이 섞였으면 분리 제안.
6. **IA 제안**: 주제로 묶어 폴더 구조를 제안하고 사람이 확정/재명명. 기획·설계는 `.manifast/`,
   설명/유저문서는 `docs/<type>/`.
7. **gap 분석**: 코드 표면(공개 API·CLI·설정·주요 모듈)에 문서를 겹쳐 **빠진/얇은** 문서를 보고.
8. **마이그레이션**: 정본 IA + 머지맵 + (옮길 때) 옛 경로에 tombstone/`deprecated` 안내. 작은 배치로
   적용. 끝나면 다이어그램(§5b)으로 결과 구조를 그려 사람이 눈으로 검수.

**모드 A 완료 후 — 하이브리드 운영 전환:**
구조화가 끝나면 이후 신규 문서는 처음부터 Manifast 형식으로 `.manifast/`에 직접 만든다.
- **설계·기획** (스펙, PRD, ADR, 아키텍처): `.manifast/specs/` 또는 `.manifast/prd/`
- **실행 기록** (계획서, 결과, 핸드오프): `docs/` — frontmatter만 관리
- `docs/`는 실행 기록과 도메인 레퍼런스 전용으로 남긴다.
이 경계를 지키면 `.manifast/` 파일은 항상 구조가 보장되고, `docs/`는 자유롭게 쓸 수 있다.

## 신선도 & drift 유지 (상시)

- **`sources`는 모든 문서에 필수 선언**: `active`·`done`·`draft` 상태의 문서는 예외 없이
  `sources`를 frontmatter에 선언해야 한다. **`sources` 필드 자체가 없는 것은 허용하지 않는다.**
  - **코드 인접 문서** (본문에 `services/`, `apps/`, `src/`, `.py`, `.ts` 등 코드 경로·모듈명 등장):
    구체 파일 또는 디렉터리 prefix를 적는다. 예: `[services/worker/domain/grammar.py]`
  - **코드 무관 문서** (순수 레퍼런스·체크리스트·인덱스·프로세스 문서):
    `sources: []` — 빈 배열로 "코드 없음"을 **명시적으로 선언**한다.
  - **`deprecated`·`archived`**: `sources: []` (신선도 점검 제외).
  앱이 `sources` 파일의 mtime이 `lastReviewed`보다 새로우면 **stale** 배지를 띄운다(AI 없이 비교).
- **drift 판정은 네 몫**: 코드가 바뀌면 영향받는 문서(인용 심볼·`sources` 기준, 텍스트 diff보다
  구조/AST 기준 권장)를 찾아 **같은 작업에서 문서도 고친다**.
- **검토 주기**: 중요한 문서엔 `owner`와 `reviewBy`(일)를 둔다. 검토를 마치면 사람이 앱의 **Review**
  버튼으로 `lastReviewed`를 갱신(re-bless)한다. **너는 `reviewBy`만 채우고 `lastReviewed`는 비워 둔다** —
  미리 채우면 stale 신호가 처음부터 죽는다. 예외: 명시적 drift-fix 패스에서 직접 정확성을 확인한 경우에만
  오늘 날짜를 스탬핑한다.
- **상태 정리**: 더 이상 맞지 않는 문서는 지우지 말고 `deprecated`(후속 `deprecatedBy`) 또는
  `archived`로. archived는 신선도 점검에서 제외된다.
- **큰 파일·인코딩**: **100KB 이상** 파일은 **head(~16KB)만 읽어** 분류한다 — 앱도 목록에서
  앞 16KB만 읽으므로 그 이후 내용은 메타에 반영되지 않는다. 통째로 읽지 말 것. frontmatter는 파일 맨 위에 두고, 넣을 때 **기존 줄바꿈(EOL)을
  유지**한다(LF/CRLF가 섞이면 diff가 지저분해짐).

## 7. 작업 완료 체크리스트

코드 변경이 끝날 때마다 `CHECKLIST.md`(같은 디렉터리)를 실행한다:
tasks.json 상태 업데이트 → plan.json 진행상황 → sources drift 확인 → 신규 기능 spec 생성 → 다이어그램 갱신.

기능 개발 전 과정(설계→계획→구현)을 자동화하려면 `WORKFLOW.md`(같은 디렉터리)를 사용한다.

## 8. Don't

- Don't invent node `type`s outside the 18-item catalog.
- Don't put `children` on anything except `Box`.
- Don't write files outside `.manifast/` or use absolute paths.
- Don't edit `.manifast/schema/*.json` (generated contract).
- Don't leave a file as invalid JSON/frontmatter. After edits, bump `updatedAt`.
