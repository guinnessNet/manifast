---
name: brainstorm
description: Use when starting a new feature, exploring design options, or deciding how to approach a problem — before writing any code. Explores 2-3 approaches, asks one question at a time, produces a spec doc, and requires user approval before proceeding.
---

# Brainstorm — 설계 탐색 스킬

코드 한 줄도 쓰기 전에 설계를 확정한다.

**시작 선언:** "Brainstorm: [기능/문제]"

---

## 하드 게이트

설계 승인 전까지 코드 작성·스캐폴딩·구현 행동 일체 금지.

---

## 진행 순서

**1. 프로젝트 컨텍스트 파악**
- `.manifast/` 전체 읽기 (prd, specs, tasks, plan, diagrams)
- 현재 태스크 상태·로드맵 단계 파악
- 관련 기존 코드·패턴 탐색

**2. 요건 탐색 (질문 하나씩)**
- 목적, 제약, 성공 기준을 파악한다
- **한 메시지에 질문 하나만** — 복수 질문 금지
- 가능하면 객관식으로 제시, 추천 포함

**3. 접근법 2–3개 제안**
- 각 접근법의 트레이드오프 명시
- 추천 접근법과 이유 제시
- 과잉 설계(YAGNI 위반) 제거

**4. 설계 문서 작성**
설계 승인 후 `.manifast/specs/<YYYY-MM-DD>-<feature-id>.md`에 저장.

필수 frontmatter:
```yaml
schema: manifast.doc/1
id: <feature-id>
type: spec
title: <기능명>
status: draft
sources: []
owner: <owner>
```

필수 섹션: 목표 · 아키텍처 · 컴포넌트 · 데이터 흐름 · 에러 처리 · 테스트 전략

**5. 자가 검토**
- TBD·TODO·빈 섹션 없는지 확인
- 내부 모순 확인
- 단일 구현 계획으로 충분한 범위인지 확인

**6. 사용자 검토 요청**
> "설계 문서를 `.manifast/specs/<path>`에 저장했습니다. 검토 후 `/write-plan`으로 넘어갈지 알려주세요."
