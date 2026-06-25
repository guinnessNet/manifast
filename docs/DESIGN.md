---
schema: manifast.doc/1
id: design-index
type: reference
title: Manifast 상세 설계 — 인덱스
status: active
owner: kjh
sources: [src/shared/schema, src/server, src/web]
related: [design-v1-spec, design-appendix-b-v2-docs, design-appendix-c-v3-diagrams, design-appendix-d-v4-governance, docs-archive-raw-DESIGN]
createdAt: 2026-06-26
updatedAt: 2026-06-26
---

# Manifast 상세 설계 — 인덱스

원래 한 파일이던 `DESIGN.md`(v1 사양 + 부록 B·C·D)를 주제별로 분할했다. 통짜 원본은 [`docs/archive/raw/DESIGN.md`](archive/raw/DESIGN.md)에 그대로 보존돼 있다(아카이브).

## 구성

- [v1 코어 사양](design/v1-spec.md) — §0–13 + 부록 A(init 예제). 시스템 아키텍처·데이터 모델·렌더링·라이브리로드·Export·CLI.
- [부록 B — v2 문서 관리](design/appendix-b-v2-docs.md) — 멀티 소스 docs, 앱의 frontmatter 쓰기(uid/status), uid 이동추적.
- [부록 C — v3 다이어그램/맵](design/appendix-c-v3-diagrams.md) — `manifast.diagram/1`, Map 뷰, 자동 프로젝트 맵.
- [부록 D — v4 거버넌스](design/appendix-d-v4-governance.md) — 지속지시(constitution), 신선도/drift, 기존 더미 구조화 플레이북.

> 버전별 변경 이력은 [`../CHANGELOG.md`](../CHANGELOG.md), 코드 작업 가이드는 [`../CLAUDE.md`](../CLAUDE.md).
