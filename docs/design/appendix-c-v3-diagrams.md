---
schema: manifast.doc/1
id: design-appendix-c-v3-diagrams
type: reference
title: 설계 부록 C — v3 다이어그램 / 맵
status: active
owner: kjh
sources: [src/shared/schema/diagram.ts, src/web/lib/graph.ts, src/web/lib/layout.ts, src/web/components/diagram/MapView.tsx]
related: [design-v1-spec, design-index, docs-archive-raw-DESIGN]
createdAt: 2026-06-26
updatedAt: 2026-06-26
---

> 원래 DESIGN.md의 부록 C를 분리한 문서. 출처: `docs/archive/raw/DESIGN.md`.

## 부록 C. v3 변경 — 다이어그램 / 맵 (조직도·구조도)

- **범용 다이어그램 아티팩트** `manifast.diagram/1` (`.manifast/diagrams/*.json`):
  `nodes`/`edges`/`groups`/`kind`(architecture|docmap|flow|…)/`direction`. 에이전트가
  코드·문서를 **분석해 작성**(인앱 AI 없음), 앱은 **dagre 자동 레이아웃**으로 렌더.
- **Map 뷰**(5번째): 다이어그램 선택 드롭다운 + pan/zoom 캔버스 재사용. 노드 `ref`로 항목 점프.
- **자동 프로젝트 맵**: 앱이 기존 링크(doc↔wireframe↔task↔plan)+uid로 그래프를 자동 생성(파일 불필요).
- **루트 문서 소스**: 기본 문서 소스에 `CLAUDE.md`/`AGENTS.md`/`README.md` 추가.
- 한계: "추적"은 현재 스냅샷 + `generatedAt` 스탬프. 코드 정적 분석은 앱이 하지 않음(에이전트 담당).

---
