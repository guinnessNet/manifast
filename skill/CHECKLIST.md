---
name: manifast-checklist
description: Run after every code change to keep Manifast documents (tasks, plan, specs, diagrams) in sync with the implementation. Attach to any coding task.
---

# Manifast 작업 완료 체크리스트

**코드 변경이 끝날 때마다 이 체크리스트를 실행한다.**
Manifast 뷰어가 현재 구현 상태를 정확히 반영하도록 유지한다.

---

## 필수 항목

- [ ] **1. 태스크 상태 업데이트** (`.manifast/tasks/tasks.json`)
  - 완료한 태스크 → `"status": "done"`
  - 작업 중 발견한 새 작업 → 신규 항목 추가 (`"status": "todo"`, 새 `id`)
  - 블로커 발생 시 → `"status": "blocked"` (title에 이유 기록)

- [ ] **2. 로드맵 진행상황 업데이트** (`.manifast/plan/plan.json`)
  - 해당 phase의 모든 `taskIds`가 done → phase `"status": "done"`
  - 다음 phase 시작 → `"status": "active"`

- [ ] **3. Sources drift 확인**
  1. 내가 수정/추가한 파일 목록 파악
  2. 그 파일을 `sources`로 갖는 `.manifast/` 또는 `docs/` 문서 탐색
  3. 문서 본문과 현재 코드 비교 — 아래 stale 기준 적용
  4. stale 확인되면 → frontmatter `updatedAt` 갱신 + 본문 수정 필요 목록 보고

  **stale 기준:**
  - 문서가 언급하는 함수·클래스·파일이 삭제/이름 변경됨
  - 문서가 설명하는 동작이 현재 코드와 달라짐
  - `sources` 파일이 대규모 리팩터링됨

- [ ] **4. 신규 기능/모듈 문서화**
  - 새 기능·서비스·모듈 추가 시 `.manifast/specs/<feature-id>.md` 생성
  - 필수 frontmatter: `schema · id · type: spec · title · status: active · sources: [추가한 파일들]`
  - `reviewBy`(검토 주기)·`owner` 설정 권장

- [ ] **5. 아키텍처 다이어그램 갱신**
  - 새 컴포넌트·서비스 추가 또는 관계 변경 시 `.manifast/diagrams/` 업데이트
  - 새 노드/엣지 추가, 삭제된 노드/엣지 제거, `generatedAt` 갱신

---

## 드리프트 탐지 빠른 순서 (헤드리스)

```
1. 수정 파일 목록 확인 (git diff --name-only 또는 작업 내역)
2. 각 파일명으로 sources 필드 grep → 연결된 문서 찾기
3. tasks.json 열어 완료/신규 태스크 반영
4. plan.json 열어 phase 진행상황 반영
5. 신규 기능이면 specs/ 파일 생성
6. 아키텍처 변경이면 diagrams/ 갱신
```

완료 후 Manifast 뷰어(`manifast <project>`)에서 Tasks · Plan · Map 뷰를 확인한다.
