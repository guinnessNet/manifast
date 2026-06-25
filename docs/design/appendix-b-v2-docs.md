---
schema: manifast.doc/1
id: design-appendix-b-v2-docs
type: reference
title: 설계 부록 B — v2 문서 관리
status: active
owner: kjh
sources: [src/server/workspace.ts, src/server/edit.ts, src/server/index.ts]
related: [design-v1-spec, design-index, docs-archive-raw-DESIGN]
createdAt: 2026-06-26
updatedAt: 2026-06-26
---

> 원래 DESIGN.md의 부록 B를 분리한 문서. 출처: `docs/archive/raw/DESIGN.md`.

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
