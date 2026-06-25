---
name: write-plan
description: Use after brainstorming to write a detailed implementation plan. Uses dialectical 정반합 (thesis-antithesis-synthesis) reasoning — the agent writes a plan, attacks it with 8 critical questions, then synthesizes a verified final plan. Requires user approval before implementation.
---

# Write Plan — 정반합 계획 검증 스킬

초안 계획을 스스로 공격하고 검증해 품질을 보장한다.

**시작 선언:** "Write Plan: [스펙 파일 경로 또는 기능명]"

---

## 정 (正, Thesis) — 초안 계획 작성

**파일 구조 매핑**
- 생성/수정할 파일과 각 책임 정의
- 파일 간 인터페이스(함수명·타입·반환값) 확정

**태스크 분해 규칙**
- 각 태스크 = 독립적으로 테스트 가능한 최소 단위
- 순서: 실패 테스트 → 구현 → 통과 확인 → 커밋 → Manifast 체크리스트
- **Manifast 업데이트 태스크 반드시 포함** (tasks.json · plan.json · specs · diagrams)

**계획 문서 헤더 (필수)**

```markdown
# [기능명] 구현 계획

> **에이전트 워커용:** 각 태스크 완료 후 반드시 manifast-checklist를 실행한다.

**목표:** [한 문장]
**아키텍처:** [2–3문장]
**기술 스택:** [핵심 기술/라이브러리]

## 전역 제약사항
[프로젝트 전체에 적용되는 요구사항]

---
```

**태스크 구조**

```markdown
### 태스크 N: [컴포넌트명]

**파일:**
- 생성: `exact/path/to/file.py`
- 수정: `exact/path/to/existing.py`

**인터페이스:**
- 소비: [앞 태스크에서 사용할 함수·타입 — 정확한 시그니처]
- 제공: [뒤 태스크가 의존할 함수·타입]

- [ ] 실패 테스트 작성
- [ ] 실패 확인
- [ ] 최소 구현 작성
- [ ] 통과 확인
- [ ] 커밋
- [ ] **Manifast 체크리스트 실행**
```

---

## 반 (反, Antithesis) — 계획 비판

초안 완성 후, **비판자 역할로 전환**해 아래 8가지 질문으로 계획을 공격한다:

1. **실패 시나리오**: 이 계획이 실패하는 상황은? 어떤 엣지 케이스가 빠졌나?
2. **가정 검증**: 근거 없이 당연하게 가정한 것은? 잘못될 가능성은?
3. **설계 과잉**: YAGNI 위반 — 지금 당장 필요하지 않은데 포함된 것은?
4. **설계 부족**: 나중에 큰 리팩터링이 필요해질 부분은?
5. **인터페이스 불일치**: 태스크 간 타입·함수명이 맞지 않는 부분은?
6. **Manifast 누락**: 태스크 완료 후 Manifast 업데이트를 빠뜨린 곳은?
7. **테스트 공백**: 테스트가 없거나 의미 없는 태스크는?
8. **순서 문제**: 의존성 순서가 잘못된 태스크 쌍은?

비판 목록 형식:
```markdown
## 반 (反) 비판 목록
- [CRITICAL] ...
- [IMPORTANT] ...
- [MINOR] ...
```

---

## 합 (合, Synthesis) — 최종 계획 확정

비판 목록을 반영해 계획을 수정하고 이유를 기록한다:

```markdown
## 정반합 검증 결과

### 반영한 비판
- [비판 항목] → [수정 내용]

### 기각한 비판 (이유)
- [비판 항목] → [기각 이유: YAGNI / 범위 밖 / 이미 처리됨]
```

**저장:** `docs/plans/<YYYY-MM-DD>-<feature-id>-plan.md`

**사용자 검토 요청:**
> "정반합 검증 완료. 계획을 `<path>`에 저장했습니다. 검토 후 `/implement`로 진행할까요?"
