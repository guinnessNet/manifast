---
schema: manifast.doc/1
id: design-appendix-d-v4-governance
type: reference
title: 설계 부록 D — v4 문서 거버넌스 / 지속관리
status: active
owner: kjh
sources: [src/cli/init.ts, src/server/workspace.ts, src/server/edit.ts, skill/SKILL.md]
related: [design-v1-spec, design-index, docs-archive-raw-DESIGN]
createdAt: 2026-06-26
updatedAt: 2026-06-26
---

> 원래 DESIGN.md의 부록 D를 분리한 문서. 출처: `docs/archive/raw/DESIGN.md`.

## 부록 D. v4 변경 — 문서 거버넌스 / 지속관리 (지속지시 · 신선도 · drift · 기존 더미 구조화)

> v2(부록 B)의 "앱은 frontmatter 메타만 쓴다" 완화를 **거버넌스 메타로 확장**한 변경이다
> (프로젝트 오너 결정). 이 부록이 기준이며, 충돌 시 §0/§3 및 부록 B의 메타 범위 문구보다 우선한다.
> **인앱 AI·MCP·DB·auth 없음 제약은 그대로 유지** — 모든 "지능"(분석·요약·클러스터링·dedup·ROT
> 분류·drift 판정)은 외부 에이전트(스킬)가 수행하고, 앱은 그 결과(frontmatter)를 렌더 + **AI 없는
> 경량 신호**(파일 mtime 비교)만 계산한다. wireframes/tasks/plan은 여전히 `.manifast/` 전용·읽기전용.

### D.1 지속지시 — init이 규칙을 박는다

- **constitution 블록**: `manifast init`은 프로젝트 루트의 `CLAUDE.md`·`AGENTS.md`에
  `<!-- manifast:begin -->`…`<!-- manifast:end -->` 마커로 감싼 **관리 블록을 멱등 병합**한다
  (있으면 갱신, 없으면 생성/append). 마커 밖 사용자 내용은 **절대 건드리지 않는다**(부록 B의
  "기존 파일 미덮어씀" 원칙 유지·강화 — 기존 AGENTS.md를 skip하던 동작을 병합으로 대체). 블록은
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
