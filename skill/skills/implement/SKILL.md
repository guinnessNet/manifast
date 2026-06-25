---
name: implement
description: Use after write-plan to execute the implementation plan task by task. Dispatches a fresh subagent per task, runs a review gate after each, and automatically runs the manifast-checklist to keep tasks.json, plan.json, and specs in sync with the code.
---

# Implement — 서브에이전트 구현 스킬

계획 파일을 태스크 단위로 실행한다. 태스크마다 신선한 서브에이전트를 디스패치하고 리뷰 게이트를 통과해야 다음으로 넘어간다.

**시작 선언:** "Implement: [계획 파일 경로]"

---

## 원칙

- **태스크당 신선한 서브에이전트** — 이전 세션 컨텍스트 오염 없음
- **블로커 발생 시 즉시 중단** — 추측하지 말고 보고
- **모든 태스크 완료 시 Manifast 체크리스트 실행** — tasks.json·plan.json 동기화

---

## 각 태스크 실행 순서

```
1. 계획 파일에서 해당 태스크 텍스트 추출
2. 구현 서브에이전트 디스패치
   전달: 태스크 브리프 + 전역 제약 + 앞 태스크 인터페이스
   금지: 전체 계획 파일 통째로 전달
3. 구현 완료 확인:
   - 코드 커밋됨
   - 테스트 통과 (결과 포함)
   - Manifast 체크리스트 실행 완료
4. 리뷰 서브에이전트 디스패치 (diff 전달)
   검토: spec 준수 + 코드 품질
5. 리뷰 통과 → 다음 태스크 / 미통과 → 수정 서브에이전트
```

---

## 서브에이전트 디스패치 프롬프트 구조

```
컨텍스트: [이 태스크가 전체에서 어떤 위치인지 한 줄]
브리프: [태스크 전문]
전역 제약: [계획의 Global Constraints 섹션]
앞 태스크 인터페이스: [사용할 함수·타입 — 정확한 시그니처]
보고서 저장 경로: docs/plans/task-N-report.md

완료 후 반드시:
1. 테스트 실행 결과 포함
2. Manifast 체크리스트 실행 (tasks.json·plan.json 업데이트)
3. 상태 보고: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
```

---

## 상태별 처리

| 상태 | 처리 |
|---|---|
| `DONE` | diff 생성 → 리뷰 서브에이전트 |
| `DONE_WITH_CONCERNS` | 우려사항 검토 후 리뷰 또는 수정 |
| `NEEDS_CONTEXT` | 누락 컨텍스트 보충 후 재디스패치 |
| `BLOCKED` | 원인 파악 → 보고 후 중단 |

---

## 진행 장부 (컨텍스트 압축 대비)

재시작 시 `.manifast/workflow-progress.md`를 먼저 읽어 완료 태스크를 건너뜀.

```markdown
# Workflow Progress
태스크 1: 완료 (커밋 <hash>, 리뷰 통과)
태스크 2: 완료 (커밋 <hash>, 리뷰 통과)
태스크 3: 진행 중
```

완료된 태스크는 절대 재디스패치 금지.

---

## 전체 완료 후

1. 최종 코드 리뷰 (전체 브랜치 diff)
2. 모든 태스크 done인지 `tasks.json` 확인
3. 완료된 phase가 있으면 `plan.json` 업데이트
4. `.manifast/workflow-progress.md` 삭제
5. 사용자에게 완료 보고
