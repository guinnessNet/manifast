# Manifast — 상세 설계 문서 (v1)

> **[현재 상태]** 이 문서는 **v1 사양**입니다. v2(문서 관리)·v3(다이어그램/맵) 변경은
> **부록 B·C**에 있고, 버전별 변경 이력은 [`../CHANGELOG.md`](../CHANGELOG.md), 코드 작업
> 가이드는 [`../CLAUDE.md`](../CLAUDE.md) 를 보세요.

> 개인용 로컬 AI-개발 워크스페이스 시각화 도구.
> Claude Code / Codex 가 **스킬**로 `.manifast/` 폴더에 구조화된 파일(와이어프레임 JSON + 개발문서)을 생성하면,
> 이 도구가 **시각화 · 라이브 리로드 · Export** 한다.

이 문서는 구현에 필요한 모든 결정을 **애매함 없이** 확정한다. 구현 에이전트는 이 문서를 1순위 사양으로 따른다.

---

## 0. 목적 & 범위

### 0.1 확정된 결정 (사용자 선택)
- **사용 형태**: 개인용(싱글 유저). 인증·협업·멀티유저·DB·클라우드 **없음**.
- **AI 생성 위치**: 앱 **밖**. Claude Code / Codex 가 파일을 생성·수정한다. 앱은 인앱 AI 호출·MCP **안 함**.
- **편집 범위**: **보기 + Export 전용**. 앱은 파일을 쓰지 않는다(읽기 전용). 모든 저작은 에이전트가 파일을 고쳐서 한다.
- **파일 포맷(하이브리드)**: 와이어프레임 = JSON, 문서(PRD·기능명세) = Markdown + frontmatter, 태스크·플랜 = JSON.
- **문서 유형**: PRD, 기능 명세, 태스크 보드, 구현 계획/로드맵 (4종 전부).
- **실행 형태**: 로컬 웹앱. `npx manifast` 로 프로젝트 폴더에서 실행 → 브라우저로 열림.

### 0.2 In Scope (v1)
1. `npx manifast` CLI: 로컬 서버 기동 + 브라우저 오픈.
2. `manifast init`: 프로젝트에 `.manifast/` 스캐폴드 + **Manifast-managed 가이드/스키마 설치·갱신**(Claude Code skill, `.manifast/AGENTS.md`, JSON Schema, 루트 `CLAUDE.md`/`AGENTS.md` 지시 블록). 예제 파일은 현재 시딩하지 않는다.
3. `.manifast/` 폴더를 **폴더 규약**으로 발견·파싱·검증.
4. 핵심 뷰: **와이어프레임**(캔버스, 저충실도 렌더), **문서**(PRD/스펙 Markdown), **태스크 보드**(칸반), **플랜/로드맵**. v2/v3 부록에서 **Map/User Flow/Tree** 뷰가 추가된다.
5. **라이브 리로드**: 파일 변경 감지 → 브라우저 자동 갱신.
6. **검증 에러 표시**: 에이전트가 잘못된 파일을 써도 빈 화면이 아니라 명확한 에러 배너.
7. **Export**: 와이어프레임(PNG/SVG/HTML/JSON), 문서(MD/HTML), 전체(ZIP).
8. 항목 간 **링크**(스펙 ↔ 와이어프레임 ↔ 태스크 ↔ 플랜) 시각화.

### 0.3 Out of Scope (v1 / 향후)
- 앱 내 편집(드래그·수정·저장). *— 향후 옵션.*
- 인증/팀/멀티플레이어/클라우드 동기화/결제.
- 인앱 Anthropic API 호출, MCP 서버.
- DB(파일이 유일한 진실 소스).
- git 연동(파일 읽기 이상).

---

## 1. 사용자 워크플로우 (핵심 루프)

```
1. (최초 1회) 프로젝트에서  npx manifast init
      → .manifast/ 스캐폴드 + 스킬 설치(.claude/skills/manifast/, AGENTS.md, .manifast/schema/)

2. Claude Code / Codex 에게:  "로그인/대시보드 화면이랑 PRD 짜줘"
      → 에이전트가 manifast 스킬을 읽고, 스키마대로
        .manifast/wireframes/*.json, .manifast/prd/prd.md, .manifast/specs/*.md,
        .manifast/tasks/tasks.json, .manifast/plan/plan.json 을 생성/수정

3. (상시 실행)  npx manifast
      → http://localhost:4317 자동 오픈. 와이어프레임/문서/태스크/플랜이 보임.

4. 에이전트에게 "헤더에 검색바 추가해줘" → 에이전트가 해당 JSON 수정
      → 파일 변경 감지 → 브라우저 자동 새로고침(해당 뷰만 갱신, 깜빡임 표시)

5. Export 버튼으로 PNG/HTML/MD/ZIP 내보내기
```

도구는 **항상 켜둔 채** 에이전트와 나란히 쓰는 "라이브 미리보기 + 문서 대시보드"다.

---

## 2. 시스템 아키텍처

```
┌──────────────────────────── manifast (npm 패키지, bin: manifast) ────────────────────────────┐
│                                                                                               │
│  CLI (src/cli)                                                                                │
│    manifast            → 서버 기동 + 브라우저 오픈                                              │
│    manifast init       → 스캐폴드 + 스킬 설치                                                   │
│    manifast <dir>      → 대상 폴더 지정                                                         │
│                                                                                               │
│  Local Server (src/server, Fastify, 포트 4317 기본)                                            │
│    • @fastify/static  → 빌드된 React SPA 서빙                                                   │
│    • chokidar         → <project>/.manifast/** 워칭                                            │
│    • @fastify/websocket → 변경 이벤트 푸시 (/ws)                                                │
│    • REST: GET /api/workspace, GET /api/file?path=…                                            │
│    • workspace.ts: 파일 발견·파싱·zod 검증                                                       │
│                                                                                               │
│  Web SPA (src/web, Vite + React + TS + Tailwind + shadcn/ui)                                   │
│    • WorkspaceNav | WireframeCanvas | DocView | TaskBoard | Roadmap | ExportMenu               │
│    • useLiveReload(): /ws 구독 → 변경 path 재-fetch → 해당 뷰 재렌더                            │
│                                                                                               │
│  Skill assets (skill/)  ← manifast init 이 프로젝트로 복사                                      │
│    • SKILL.md (Claude Code) • AGENTS.md (Codex) • schema/*.json • examples/                    │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                       ▲ 읽기                              ▲ 쓰기(에이전트만)
                       │                                   │
        <project>/.manifast/   ←─── Claude Code / Codex ───┘
```

**단일 진실 소스 = `.manifast/` 폴더의 파일들.** 서버는 상태를 저장하지 않는다(읽고 검증하고 전달만). 앱은 파일을 쓰지 않는다.

---

## 3. 파일 레이아웃 & 데이터 모델 (계약)

### 3.1 `.manifast/` 폴더 구조 (폴더 규약 발견)

```
<project>/.manifast/
  manifast.json              # 프로젝트 메타(선택). 없으면 폴더명으로 추론.
  schema/                    # init 이 설치한 JSON Schema (에이전트·앱 공용 검증)
    wireframe.schema.json
    tasks.schema.json
    plan.schema.json
    frontmatter.schema.json
  wireframes/
    <screen-id>.json         # 화면 1개 = 컴포넌트 트리 1개
  prd/
    prd.md                   # PRD (Markdown + frontmatter)
  specs/
    <feature-id>.md          # 기능 명세 (Markdown + frontmatter)
  tasks/
    tasks.json               # 태스크 보드 전체
  plan/
    plan.json                # 구현 계획/로드맵
```

**발견 규칙(앱):**
- `wireframes/*.json` → 와이어프레임 화면 목록(파일당 1화면).
- `prd/*.md` → PRD 문서.
- `specs/*.md` → 기능 명세 목록.
- `tasks/tasks.json` → 태스크 보드(단일 파일).
- `plan/plan.json` → 플랜(단일 파일).
- 위에 없는 파일은 무시. 폴더가 없으면 해당 뷰는 "비어 있음" 상태.

### 3.2 `manifast.json` (프로젝트 메타, 선택)

```ts
interface Manifest {
  schema: "manifast/1";
  project: { name: string; description?: string };
  generatedBy?: "claude-code" | "codex" | string;
  updatedAt?: string;            // ISO8601
}
```
링크 정보는 여기에 두지 않는다(중복 방지). 링크는 각 항목이 보유한다(§3.7).

### 3.3 와이어프레임 JSON 스키마

좌표계: **각 노드의 `frame`은 부모 기준 절대좌표(px)**. 루트 노드는 Screen 기준. 렌더는 부모 `position:relative` + 자식 `position:absolute`로 중첩 → 부모를 옮기면 자식이 따라온다(에이전트가 좌표만 정확히 쓰면 됨).

```ts
type Device = "desktop" | "tablet" | "mobile";
// 기본 캔버스 크기: desktop 1440×1024, tablet 834×1112, mobile 390×844

interface Frame { x: number; y: number; w: number; h: number } // px, 부모 기준

interface Screen {
  schema: "manifast.wireframe/1";
  id: string;                    // 파일명과 일치 권장 (screen-login.json → "screen-login")
  name: string;                  // 표시 이름
  device: Device;
  size: { w: number; h: number };
  background?: string;           // hex, 기본 "#FFFFFF"
  root: WireNode[];              // 최상위 노드들
}

interface BaseNode { id: string; type: string; frame: Frame; name?: string }

// 컨테이너는 Box 뿐(루트 배열 + Box.children). 나머지는 모두 leaf.
type WireNode =
  | BoxNode | TextNode | ButtonNode | InputNode | TextareaNode
  | CheckboxNode | RadioNode | ToggleNode | SelectNode | ImageNode
  | AvatarNode | IconNode | DividerNode | BadgeNode
  | NavbarNode | TableNode | ListNode | TabsNode;
```

**노드 카탈로그(고정 18종)** — 한 개념 = 한 타입:

| type | 추가 필드 | 의미 |
|---|---|---|
| `Box` | `variant?: "card"\|"section"\|"plain"`(기본 plain), `children: WireNode[]` | 유일한 컨테이너(카드/섹션/그룹) |
| `Text` | `content: string`, `role?: "h1"\|"h2"\|"h3"\|"body"\|"caption"\|"label"`(기본 body), `align?: "left"\|"center"\|"right"` | 텍스트 |
| `Button` | `label: string`, `variant?: "primary"\|"secondary"\|"ghost"`(기본 primary), `size?: "sm"\|"md"\|"lg"`(기본 md) | 버튼 |
| `Input` | `label?`, `placeholder?`, `kind?: "text"\|"search"\|"password"\|"email"\|"number"`(기본 text) | 입력 필드 |
| `Textarea` | `label?`, `placeholder?`, `rows?: number`(기본 3) | 여러 줄 입력 |
| `Checkbox` | `label?`, `checked?: boolean` | 체크박스 |
| `Radio` | `label?`, `checked?: boolean` | 라디오 |
| `Toggle` | `label?`, `on?: boolean` | 토글 스위치 |
| `Select` | `label?`, `placeholder?`, `options?: string[]` | 드롭다운 |
| `Image` | `ratio?: string`(예 "16:9"), `label?: string`(기본 "Image") | 이미지 플레이스홀더(대각선 X 박스) |
| `Avatar` | `shape?: "circle"\|"square"`(기본 circle) | 아바타 |
| `Icon` | `name: string`(lucide 아이콘명), `size?: number`(기본 24) | 아이콘 |
| `Divider` | `orientation?: "horizontal"\|"vertical"`(기본 horizontal) | 구분선 |
| `Badge` | `label: string`, `tone?: "neutral"\|"info"\|"success"\|"warning"\|"danger"`(기본 neutral) | 배지/태그 |
| `Navbar` | `brand?: string`, `links?: string[]`, `actions?: string[]` | 상단 내비게이션 바 |
| `Table` | `columns: string[]`, `rows?: number`(기본 5) | 표(헤더 + N개 플레이스홀더 행) |
| `List` | `items?: number`(기본 5), `withAvatar?: boolean`, `withIcon?: boolean` | 리스트(N개 플레이스홀더 행) |
| `Tabs` | `tabs: string[]`, `activeIndex?: number`(기본 0) | 탭 바 |

**에이전트용 권장 기본 크기(검증 강제 아님, 작성 가이드):** Button 120×40 / Input·Textarea·Select 280×40 / Navbar (화면폭)×64 / Avatar 40×40 / Icon 24×24 / Divider (부모폭)×1 / Table 행당 44 / List 항목당 56.

**검증 규칙:** `schema`·`id`·`name`·`device`·`size`·`root` 필수. 각 노드 `id`·`type`·`frame` 필수. `type`은 카탈로그 18종만. `Box`만 `children` 허용. 알 수 없는 `type` 또는 필수 누락 → 검증 실패(해당 화면에 에러 배너).

### 3.4 PRD / 기능명세 (Markdown + frontmatter)

`prd/prd.md`, `specs/<feature-id>.md` 공통 형식. YAML frontmatter + Markdown 본문.

```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec                 # "prd" | "spec"
title: 사용자 인증
status: draft              # "draft" | "active" | "done"
wireframe: screen-login    # (선택) 연결된 와이어프레임 화면 id
tasks: [task-12, task-13]  # (선택) 연결된 태스크 id
updatedAt: 2026-06-24
---

## 배경
...일반 Markdown 본문 (GFM: 표/체크박스/코드블록 지원)...
```

**frontmatter 필드:** `schema`(필수), `id`(필수), `type`(필수: prd|spec), `title`(필수), `status`(선택, 기본 draft), `wireframe`(선택), `tasks`(선택 string[]), `updatedAt`(선택). 본문은 자유 Markdown. frontmatter 누락/`type` 오류 → 검증 경고(본문은 그대로 렌더, 헤더에 경고 표시).

### 3.5 태스크 보드 `tasks/tasks.json`

```ts
interface TasksFile {
  schema: "manifast.tasks/1";
  tasks: Task[];
}
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority?: "low" | "med" | "high";   // 기본 med
  specId?: string;                       // 연결된 스펙 id
  wireframeId?: string;                  // 연결된 화면 id
  deps?: string[];                       // 선행 태스크 id
}
```
칸반 컬럼은 **고정 4개**: `todo` / `in_progress` / `done` / `blocked`. 카드는 priority 색, spec/wireframe 링크 칩, deps 표시.

### 3.6 구현 계획/로드맵 `plan/plan.json`

```ts
interface PlanFile {
  schema: "manifast.plan/1";
  phases: Phase[];
}
interface Phase {
  id: string;
  name: string;
  goal?: string;
  status?: "planned" | "active" | "done";  // 기본 planned
  taskIds?: string[];                        // tasks.json 의 태스크 참조
}
```
세로 타임라인/단계 리스트로 렌더. 각 phase에 연결 태스크 진행률(done/total) 표시.

### 3.7 링크 모델 (단일 소스, 중복 없음)

| 링크 | 보유 위치 |
|---|---|
| 스펙 → 와이어프레임 | spec frontmatter `wireframe` |
| 스펙 → 태스크 | spec frontmatter `tasks[]` (또는 task `specId` 역방향) |
| 태스크 → 스펙/화면 | task `specId` / `wireframeId` |
| 태스크 → 태스크(선행) | task `deps[]` |
| 플랜 → 태스크 | phase `taskIds[]` |

앱은 이 필드들로 **양방향 그래프**를 메모리에서 구성해 상호 점프(클릭 시 해당 항목으로 이동)를 제공한다. 깨진 링크(없는 id 참조)는 회색 비활성 칩 + 툴팁 경고로 표시.

---

## 4. 렌더링 사양

### 4.1 와이어프레임 저충실도 렌더러

- **캔버스**: 인피니트. `transform: translate() scale()` 적용된 viewport `div`. 팬 = 스페이스+드래그 또는 휠 드래그, 줌 = Ctrl/⌘+휠(10%~400%). 화면 프레임은 `screen.size` 박스, `screen.background` 채움, 옅은 그림자.
- **노드 렌더 = 타입→React 컴포넌트 맵**. 각 노드 `position:absolute` + frame. `Box`는 자식을 중첩 렌더(부모 relative).
- **고정 그레이스케일 팔레트(브랜드색·실제 이미지 없음):**

| 토큰 | 값 |
|---|---|
| 카드/표면 | `#FFFFFF`, 보더 `#E2E2E2` |
| 섹션 채움 | `#F5F5F5` |
| 기본 보더 | `#D0D0D0` / 강조 `#9CA3AF` |
| 텍스트 | h* `#374151`, body `#6B7280`, caption/label `#9CA3AF` |
| primary 버튼 | 채움 `#374151`, 글자 `#FFFFFF` |
| secondary 버튼 | 보더 `#9CA3AF`, 글자 `#374151` |
| ghost 버튼 | 글자 `#6B7280`, 보더 없음 |
| Input | 흰 채움, 보더 `#D0D0D0`, placeholder `#9CA3AF` |
| Image | 채움 `#F0F0F0`, 보더 `#D0D0D0`, 대각선 X `#D0D0D0`, 라벨 중앙 |
| Avatar/Badge | 채움 `#E5E7EB`, 글자 `#374151` |
| Divider | `#E2E2E2` 선 |

- **폰트**: system sans. 크기: h1 28 / h2 22 / h3 18 / body 14 / caption·label 12 (px).
- **합성 노드(Navbar/Table/List/Tabs)**: 전용 렌더러로 자식 없이 props만으로 그림(예 Table = 헤더행 + `rows`개 회색 줄, List = `items`개 줄(옵션 아바타/아이콘), Tabs = 탭 라벨 바 + activeIndex 강조).
- **동일 렌더러를 Export(PNG/SVG/HTML)에도 재사용**(§6).

### 4.2 문서 렌더 (PRD/스펙)
- `gray-matter`로 frontmatter 분리 → 헤더 카드(title/type/status 배지/updatedAt/링크 칩).
- 본문 `react-markdown` + `remark-gfm`(표·작업목록·코드블록). 코드블록 하이라이트(`rehype-highlight` 또는 경량 대체).
- 우측 또는 상단에 연결된 와이어프레임 썸네일 + 태스크 칩.

### 4.3 태스크 보드
- 4컬럼 칸반(todo/in_progress/done/blocked). 카드: 제목, priority 색 점, description 1줄, spec/wireframe 링크 칩, deps 배지.
- 상단 요약: 전체 N개, 상태별 카운트, priority 필터.
- (읽기 전용 — 드래그로 상태 변경 안 함. 변경은 에이전트가.)

### 4.4 플랜/로드맵
- 세로 단계 리스트. 각 phase: 이름·goal·status 배지·연결 태스크 진행률 바(done/total)·태스크 칩.

---

## 5. 라이브 리로드

### 5.1 흐름
```
chokidar(.manifast/**, dotfiles 무시, awaitWriteFinish)
   └ add | change | unlink  → 100ms 디바운스
        └ 서버: 해당 파일 재읽기 + zod 검증
             └ WS 브로드캐스트: { type, path, kind, ok, error? }
                  └ 브라우저: 해당 리소스만 재-fetch → 해당 뷰 재렌더 + 살짝 깜빡(toast "updated")
```

### 5.2 REST/WS 계약
- `GET /api/workspace` → `{ project, items: { wireframes[], prd[], specs[], tasks, plan }, errors[] }` (각 item은 메타 + 검증결과).
- `GET /api/file?path=<rel>` → 와이어프레임/태스크/플랜은 파싱된 JSON + `{ok,error}`; 문서는 `{ frontmatter, markdown, ok, error }`.
- `WS /ws` → 메시지 `{ type: "change"|"add"|"unlink", path: string, kind: "wireframe"|"doc"|"tasks"|"plan"|"manifest"|"other", ok: boolean, error?: string }`.

### 5.3 검증·에러 UX
- JSON 파싱 실패/zod 실패 → 그 항목에 **빨간 에러 배너**(파일 경로 + 사유 + 첫 검증 오류). 다른 항목은 정상 렌더.
- 에이전트가 파일을 "쓰는 중"(부분 저장)일 때: `awaitWriteFinish`로 완결 후에만 처리 → 깨진 부분 읽기 방지.
- WS 끊김 시: 자동 재연결(지수 백오프) + 재연결 시 `/api/workspace` 전체 재동기화.

---

## 6. Export 사양 (전부 클라이언트 사이드)

| 대상 | 포맷 | 방법 |
|---|---|---|
| 와이어프레임 | **PNG** | 렌더된 화면 DOM → `html-to-image`(toPng, 2x 스케일) |
| 와이어프레임 | **SVG** | 렌더된 화면 DOM → `html-to-image`(toSvg) |
| 와이어프레임 | **HTML** | 노드 트리 → 절대배치 inline-style div 직렬화(자체 serializer, 1:1 frame) |
| 와이어프레임 | **JSON** | 원본 파일 그대로 다운로드 |
| 문서 | **MD** | 원본 Markdown 다운로드 |
| 문서 | **HTML** | 렌더된 문서 DOM → 정적 HTML |
| 전체 | **ZIP** | `.manifast/` 전체 파일 fetch → `JSZip` 번들 |
| (문서) | **PDF** | 브라우저 인쇄(⌘/Ctrl+P)로 대체 — 별도 구현 없음, 안내만 |

Export 버튼은 각 뷰 우상단 `ExportMenu`. 서버는 파일 제공만, 변환은 브라우저에서.

---

## 7. 스킬 패키지 (에이전트가 올바른 파일을 쓰게 만드는 핵심)

`manifast init` 이 프로젝트에 설치하는 자산. **이게 없으면 에이전트가 포맷을 모른다.**

### 7.1 설치 위치
```
<project>/.claude/skills/manifast/SKILL.md     ← Claude Code 스킬
<project>/.claude/skills/manifast/{CHECKLIST,WORKFLOW}.md
<project>/.claude/skills/{brainstorm,write-plan,implement}/SKILL.md
<project>/.manifast/AGENTS.md                  ← LLM-neutral 정본 작성 가이드
<project>/.manifast/schema/*.json              ← JSON Schema(검증 계약)
<project>/.manifast/{wireframes,prd,specs,tasks,plan,diagrams}/
<project>/CLAUDE.md, <project>/AGENTS.md        ← managed directive block(마커 밖 사용자 텍스트 보존)
```

### 7.2 `SKILL.md` (Claude Code) 구성
- frontmatter: `name: manifast`, `description:`(언제 쓰는지 — "와이어프레임/PRD/기능명세/태스크/플랜 구조를 설계할 때").
- 본문(에이전트 지침):
  1. **폴더 레이아웃**(§3.1)과 **파일 1개 규칙**(화면=파일 1개, 스펙=파일 1개).
  2. **각 스키마 요약**(§3.3~3.6) + `.manifast/schema/*.json` 참조.
  3. **규칙**: 좌표는 부모기준 절대값, 카탈로그 18종만, `Box`만 컨테이너, frame은 겹치지 않게(권장 기본크기 표), 링크 필드는 단일소스(§3.7), 파일은 항상 유효 JSON/frontmatter 유지, 변경 후 `updatedAt` 갱신.
  4. **few-shot 예제**: 작은 로그인 화면 JSON 1개 + 스펙 MD 1개 + tasks.json 1개.
  5. **금지**: 카탈로그 밖 타입, 컨테이너 외 노드에 children, 절대경로/임의 폴더.

### 7.3 `AGENTS.md` (Codex/범용)
- Codex는 스킬 시스템이 없으므로 동일 지침을 레포 루트 `AGENTS.md`(또는 `.manifast/INSTRUCTIONS.md`)에 둔다. 내용은 SKILL.md 본문과 동일(섹션 형태). Codex가 작업 시 자동 참조.

### 7.4 스키마 동기화 (단일 소스)
- TS `zod` 스키마(`src/shared/schema/*`)가 **유일한 정의**. `zod-to-json-schema`로 `schema/*.json` 생성(빌드 시 + `manifast init` 시 복사).
- 앱 검증과 에이전트 계약이 한 소스에서 나오므로 **불일치 불가**.

---

## 8. 기술 스택 & 의존성 (확정)

| 영역 | 선택 |
|---|---|
| 런타임 | Node ≥ 20, TypeScript 5 |
| 패키지 | 단일 npm 패키지 `manifast` (bin: `manifast`) |
| 서버 | Fastify + `@fastify/static` + `@fastify/websocket` |
| 워처 | `chokidar` |
| 검증 | `zod` + `zod-to-json-schema` |
| 프론트 빌드 | Vite |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui + `lucide-react` |
| Markdown | `react-markdown` + `remark-gfm` + `gray-matter` |
| 캔버스 | 자체 DOM 렌더러(CSS transform 팬/줌). 캔버스 라이브러리 없음 |
| Export | `html-to-image`(PNG/SVG), `jszip`(번들) |
| CLI | `open`(브라우저 오픈), 경량 arg 파서(자체 또는 `mri`) |

추가 런타임 의존 최소화. DB·ORM·인증 라이브러리 **없음**.

---

## 9. 프로젝트(도구) 구조

```
manifast/
  package.json                    (bin.manifast → dist/cli/index.js, scripts: dev/build)
  tsconfig.json  vite.config.ts  tailwind.config / postcss
  src/
    cli/index.ts                  (start | init | <dir> 파싱 → 서버 기동/스캐폴드)
    server/
      index.ts                    (Fastify 앱: static + ws + routes + watcher 연결)
      watcher.ts                  (chokidar → 콜백)
      workspace.ts                (발견·읽기·파싱·zod 검증 → DTO)
      routes.ts                   (/api/workspace, /api/file)
    shared/
      schema/
        wireframe.ts tasks.ts plan.ts manifest.ts frontmatter.ts   (zod)
        index.ts                  (zod-to-json-schema 내보내기)
      types.ts                    (DTO 타입)
    web/
      index.html  main.tsx  App.tsx
      hooks/useLiveReload.ts  useWorkspace.ts
      components/
        WorkspaceNav.tsx  ErrorBanner.tsx  ExportMenu.tsx
        wireframe/{Canvas.tsx, Renderer.tsx, nodes/*.tsx}
        docs/DocView.tsx
        tasks/Board.tsx
        plan/Roadmap.tsx
      lib/{api.ts, export.ts, links.ts}
  skill/
    SKILL.md  AGENTS.md
    schema/                        (빌드 시 zod→json schema 생성물)
    examples/.manifast/...         (dev/e2e용 예제 워크스페이스; init은 시딩하지 않음)
  dist/                           (빌드: cli + server + web)
  docs/DESIGN.md
```

---

## 10. CLI 사양

| 명령 | 동작 |
|---|---|
| `npx manifast` | cwd에서 `.manifast/` 찾아 서버 기동(포트 4317, 사용 중이면 +1 탐색), 브라우저 오픈 |
| `npx manifast <dir>` | `<dir>`(또는 `<dir>/.manifast`)을 워크스페이스로 |
| `npx manifast init` | `.manifast/` 스캐폴드 + Manifast-managed 가이드/스키마 설치·갱신(§7.1). 사용자 콘텐츠는 보존하고 예제 파일은 시딩하지 않음 |
| `npx manifast --port <n>` | 포트 지정 |
| `npx manifast --no-open` | 브라우저 자동 오픈 끔 |

`init`은 사용자 소유 텍스트와 작업물을 보존한다. Manifast-managed 파일(`.manifast/AGENTS.md`, schema, Claude skill 등)은 번들 내용이 바뀌면 갱신하고, 루트 `CLAUDE.md`/`AGENTS.md`는 마커 블록만 병합·갱신한다.

---

## 11. 실행 / 환경
- 요구: Node ≥ 20. 외부 키·네트워크 불필요(완전 로컬).
- 개발: `npm run dev`(Vite + 서버 동시, 프론트 HMR). 배포: `npm run build` → `dist/`, `npx manifast` 가 정적 SPA 서빙.
- 포트 기본 4317. 데이터는 대상 프로젝트의 `.manifast/` 뿐.

---

## 12. 수용 기준 (Definition of Done)

- [ ] `npx manifast init` → `.manifast/`(wireframes/prd/specs/tasks/plan/diagrams/schema) 생성 + `.manifast/AGENTS.md` + Claude skills + 루트 지시 블록 설치·갱신. 사용자 콘텐츠 보존.
- [ ] `npx manifast` → 4317 기동 + 브라우저 오픈. 좌측 내비에 현재 뷰(Wireframes/Docs/Tasks/Plan/User Flow/Tree/Map).
- [ ] 샘플 와이어프레임 JSON → 캔버스에 저충실도 렌더(팬/줌, 18종 노드 정상).
- [ ] PRD/스펙 `.md` → frontmatter 헤더 + GFM 본문 렌더.
- [ ] `tasks.json` → 4컬럼 칸반. `plan.json` → 단계 로드맵(진행률).
- [ ] 항목 간 링크 칩 클릭 → 해당 항목 이동. 깨진 링크 경고 표시.
- [ ] **라이브 리로드**: 파일 외부 수정 시 ~300ms 내 해당 뷰 자동 갱신(전체 새로고침 없이).
- [ ] **검증 에러**: 깨진 JSON/frontmatter → 해당 항목 에러 배너, 나머지 정상.
- [ ] Export: 와이어프레임 PNG/SVG/HTML/JSON, 문서 MD/HTML, 전체 ZIP 동작.
- [ ] 인증·DB·MCP·Anthropic 호출 **없음**. 앱은 파일을 쓰지 않음(읽기 전용).
- [ ] zod 스키마 1소스 → `schema/*.json` 생성물이 init 으로 설치됨.

---

## 13. 비범위 & 향후
- **향후**: 인앱 가벼운 편집(JSON 저장 back), 다중 프로젝트 탭, 와이어프레임 ↔ 코드 생성, 링크 그래프 시각화, PDF 직접 출력, VS Code 확장 래퍼.
- **명시적 비범위(v1)**: 편집/저장, 협업, 클라우드, MCP, 인앱 AI, DB.

---

## 부록 A. 최소 예제 (작성 예시)

`.manifast/wireframes/screen-login.json`
```json
{
  "schema": "manifast.wireframe/1",
  "id": "screen-login", "name": "로그인", "device": "mobile",
  "size": { "w": 390, "h": 844 }, "background": "#FFFFFF",
  "root": [
    { "id": "n1", "type": "Text", "frame": { "x": 24, "y": 96, "w": 342, "h": 36 },
      "content": "로그인", "role": "h1", "align": "left" },
    { "id": "n2", "type": "Input", "frame": { "x": 24, "y": 160, "w": 342, "h": 44 },
      "label": "이메일", "placeholder": "you@example.com", "kind": "email" },
    { "id": "n3", "type": "Input", "frame": { "x": 24, "y": 224, "w": 342, "h": 44 },
      "label": "비밀번호", "kind": "password" },
    { "id": "n4", "type": "Button", "frame": { "x": 24, "y": 296, "w": 342, "h": 48 },
      "label": "로그인", "variant": "primary", "size": "lg" }
  ]
}
```

`.manifast/specs/feat-auth.md`
```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec
title: 사용자 인증
status: active
wireframe: screen-login
tasks: [task-1]
updatedAt: 2026-06-24
---

## 목적
이메일/비밀번호 로그인을 제공한다.

## 동작
- [ ] 이메일 형식 검증
- [ ] 실패 시 인라인 에러
```

`.manifast/tasks/tasks.json`
```json
{
  "schema": "manifast.tasks/1",
  "tasks": [
    { "id": "task-1", "title": "로그인 폼 구현", "status": "in_progress",
      "priority": "high", "specId": "feat-auth", "wireframeId": "screen-login" }
  ]
}
```

`.manifast/plan/plan.json`
```json
{
  "schema": "manifast.plan/1",
  "phases": [
    { "id": "p1", "name": "MVP 인증", "goal": "로그인/회원가입",
      "status": "active", "taskIds": ["task-1"] }
  ]
}
```

---

## 부록 B. v2 변경 — 문서 관리 (사용자 승인으로 v1 제약 완화)

> v1의 하드 제약 일부를 **의도적으로** 완화한 확장이다(프로젝트 오너 결정). 이 부록이
> 기준이며, 충돌 시 §0/§3의 "읽기 전용·단일 소스" 문구보다 우선한다.

- **멀티 소스**: 문서는 `.manifast/`(prd·specs) 외에 `docs/`(기본) 등 설정된 소스에서도
  발견한다. `manifast.json`의 `sources.docs[]`(루트 기준 디렉터리/`.md`)·`sources.exclude[]`로
  조정. 와이어프레임·태스크·플랜은 여전히 `.manifast/` 전용.
- **느슨한 흡수**: frontmatter 없는 일반 `.md`도 렌더. 제목=frontmatter→첫 H1→파일명,
  날짜=frontmatter→파일 시스템(birthtime/mtime), `docs/archive/**`는 자동 archived.
- **앱 쓰기 허용(문서 한정, 작은 메타만)**: 앱은 frontmatter의 **`uid`와 상태/메타**만 쓴다.
  **본문은 절대 쓰지 않는다.** (전체 인앱 편집은 여전히 비범위.)
  - `POST /api/doc/adopt` — `uid`(랜덤, `node:crypto`) 1회 멱등 삽입. **수동 "Adopt"** 버튼.
  - `POST /api/doc/status` — `status` + `deprecatedAt`/`archivedAt`/`deprecatedBy`/`updatedAt`.
- **uid = 이동 추적 키**: 파일 안의 `uid`로 폴더 이동/이름변경에도 동일 문서로 인식(링크 유지).
  사람용 `id`와 별개. 깊은 이동 이력(언제/누가)은 git 영역으로 여전히 비범위.
- **상태 확장**: doc `status` = draft|active|done|**deprecated|archived**. `type`에 `doc` 추가.
- **API 경로**: 모든 경로가 **프로젝트 루트 기준**(예: `.manifast/wireframes/x.json`, `docs/a.md`).

---

## 부록 C. v3 변경 — 다이어그램 / 맵 (조직도·구조도)

- **범용 다이어그램 아티팩트** `manifast.diagram/1` (`.manifast/diagrams/*.json`):
  `nodes`/`edges`/`groups`/`kind`(architecture|docmap|flow|…)/`direction`. 에이전트가
  코드·문서를 **분석해 작성**(인앱 AI 없음), 앱은 **dagre 자동 레이아웃**으로 렌더.
- **Map 뷰**(5번째): 다이어그램 선택 드롭다운 + pan/zoom 캔버스 재사용. 노드 `ref`로 항목 점프.
- **자동 프로젝트 맵**: 앱이 기존 링크(doc↔wireframe↔task↔plan)+uid로 그래프를 자동 생성(파일 불필요).
- **루트 문서 소스**: 기본 문서 소스에 `CLAUDE.md`/`AGENTS.md`/`README.md` 추가.
- 한계: "추적"은 현재 스냅샷 + `generatedAt` 스탬프. 코드 정적 분석은 앱이 하지 않음(에이전트 담당).

---

## 부록 D. v4 변경 — 문서 거버넌스 / 지속관리 (지속지시 · 신선도 · drift · 기존 더미 구조화)

> v2(부록 B)의 "앱은 frontmatter 메타만 쓴다" 완화를 **거버넌스 메타로 확장**한 변경이다
> (프로젝트 오너 결정). 이 부록이 기준이며, 충돌 시 §0/§3 및 부록 B의 메타 범위 문구보다 우선한다.
> **인앱 AI·MCP·DB·auth 없음 제약은 그대로 유지** — 모든 "지능"(분석·요약·클러스터링·dedup·ROT
> 분류·drift 판정)은 외부 에이전트(스킬)가 수행하고, 앱은 그 결과(frontmatter)를 렌더 + **AI 없는
> 경량 신호**(파일 mtime 비교)만 계산한다. wireframes/tasks/plan은 여전히 `.manifast/` 전용·읽기전용.

### D.1 지속지시 — init이 규칙을 박는다

- **constitution 블록**: `manifast init`은 프로젝트 루트의 `CLAUDE.md`·`AGENTS.md`에
  `<!-- manifast:begin -->`…`<!-- manifast:end -->` 마커로 감싼 **관리 블록을 멱등 병합**한다
  (있으면 갱신, 없으면 생성/append). 마커 밖 사용자 내용은 **절대 건드리지 않는다**(사용자 콘텐츠
  보존 원칙 유지·강화 — 기존 AGENTS.md를 통째로 대체하지 않고 마커 블록 병합으로 대체). 블록은
  *얇은 포인터*만 담는다: "기획·설계 산출물(와이어프레임·PRD/스펙·태스크·플랜·다이어그램·구조화
  문서)은 Manifast 스킬 규칙으로만 작성·갱신"(**범위 한정** — 코드/README 잡수정까지 강제하지 않음).
  절차 본문은 스킬에 둔다(progressive disclosure).
- **`@AGENTS.md` 다리**: Claude Code는 `CLAUDE.md`만 네이티브로 읽으므로, 새로 만드는 CLAUDE.md
  첫 줄에 `@AGENTS.md` import를 둬 단일 정본을 유지한다(Codex/Cursor는 AGENTS.md 직접 읽음).
- **스킬 2모드**: `SKILL.md`/`AGENTS.md`는 (A) *기존 `docs/` 구조화*와 (B) *신규 생성
  (`spec → plan → tasks` 스파인)* 두 진입을 담는다.

### D.2 거버넌스 frontmatter — 계약 확장

- **신규 필드(모두 선택)**: `owner`(DRI), `lastReviewed`(date), `reviewBy`(number=검토 TTL 일),
  `sources`(string[]=이 문서가 기술하는 코드 경로, drift 입력), `critical`(boolean).
  `DocFrontmatterSchema`(zod)에 추가 → `npm run gen:schema`로 `skill/schema/*.json`(에이전트 계약)
  자동 전파.
- **`type` 확장**: `prd|spec|doc` → `+ adr|tutorial|howto|reference|explanation|architecture`.
  first-class **지원**이며 의무가 아니다(스킬이 프로젝트 성격에 맞는 정본 세트를 고른다 —
  ceremony-overkill 회피).
- **status 어휘 유지**: `draft|active|done|deprecated|archived` 그대로(신규 용어 도입 없음).
  ADR은 별도 enum 없이 매핑한다 — proposed→`draft`, accepted→`active`, superseded→`deprecated`
  (+`deprecatedBy`=후속 ADR).
- **앱 쓰기 확장(본문은 여전히 안 씀)**:
  - `POST /api/doc/review` — `owner`/`lastReviewed`/`reviewBy` 기록(수동 "Review" 액션).
  - `POST /api/doc/status` 전이 규칙 강화 — `deprecated`는 `deprecatedBy` 동반.
  - `edit.ts`는 **배열 frontmatter(`sources`) 쓰기를 지원**해야 한다(기존 스칼라 전용 한계 해소).

### D.3 신선도 / drift — 앱=신호, 에이전트=판정

- **앱측 경량 staleness(AI 없음)**: 문서의 `sources[]` 파일 mtime이 `lastReviewed`(없으면
  `updatedAt`)보다 최신이거나 `today − lastReviewed > reviewBy`면 **stale**로 표시한다.
  `DocMeta.freshness = { score, stale, reason }`로 파생하고, 문서 헤더에 "Last reviewed by X on
  DATE" 바이라인 + 배지로 렌더. `docMetaCache`는 `sources` mtime 변화에도 무효화한다.
- **에이전트측 drift 판정(스킬)**: 코드 diff와 문서 `sources`/인용 심볼을 대조(텍스트 diff 아닌
  AST 지문 권장)해 어긋난 문서를 찾고 **같은 변경에서 수정을 제안**한다. 깊은 판정은 앱이 하지
  않는다(부록 C 한계 연장).

### D.4 시각화 — 헤어볼 회피

- **이웃 우선(focus)**: Map 뷰에서 노드 클릭 시 1~2홉 **neighborhood**만 표시(depth 컨트롤).
- **orphans / broken-link 패널**: inbound 0 문서·끊긴 참조를 별도 패널로 노출(기본 맵에선 숨김 —
  부록 C의 "unlinked 숨김" 연장). **typed-edge 필터**(`links`/`spec`/`screen`/`dep`/`deprecatedBy`)와
  group 접기.

### D.5 기존 더미 구조화 (케이스1 — 전부 스킬·제안만)

- 스킬의 ingest 파이프라인: inventory(읽기전용) → 문서별 요약 + structured 메타(frontmatter 스키마
  준수) → dedup(duplicate/variant/**conflict는 사람에게**) → **ROT 분류(삭제 질문 먼저)** →
  Diátaxis 분류·타입혼합 분리 → IA 제안(클러스터 → 라벨, 사람 확정) → 코드 표면 대비 gap →
  마이그레이션 계획(머지맵/리다이렉트/툼스톤). 모든 변경은 **reviewable draft + confidence**로
  제안하고 자동 적용하지 않는다(앱이 본문을 안 쓰는 제약과 정합).

### D.6 새 문서 타입 (first-class 지원, 의무 아님)

- **ADR**(`type: adr`): `docs/adr/NNNN-*.md`, 1결정 1파일, **불변**(고치지 말고 새 ADR로 supersede).
- **arc42 + C4**: 아키텍처 문서는 `docs/architecture/`(arc42 12섹션, 필요분만), 다이어그램은
  `manifast.diagram/1`의 `kind: architecture`로 C4 L1(Context)/L2(Container)를 그린다.
- **Diátaxis 4타입**(`tutorial|howto|reference|explanation`): 유저 대상 문서가 있을 때.
  한 페이지에 타입 혼합 금지.

- **한계**: 신선도/drift의 *판정*과 dedup·클러스터링·요약·ROT 분류는 모두 에이전트(스킬) 몫이며,
  앱은 mtime 기반 경량 신호 계산과 렌더만 한다(인앱 AI 없음). 깊은 이동/리뷰 이력은 git 영역.
