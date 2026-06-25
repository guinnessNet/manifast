---
schema: manifast.doc/1
id: prd-main
type: prd
title: Manifast Demo — 제품 요구사항
status: active
updatedAt: 2026-06-24
---

## 배경

이 문서는 `manifast init` 이 시드한 **예제 PRD** 입니다. Manifast 가
Markdown + frontmatter 문서를 어떻게 렌더하는지 보여줍니다.

## 목표

- 이메일/비밀번호 로그인 제공
- 핵심 지표를 한눈에 보는 대시보드 제공

## 범위

| 기능 | 우선순위 | 상태 |
|---|---|---|
| 로그인 | 높음 | 진행 중 |
| 대시보드 | 높음 | 완료 |
| 검색 필터 | 낮음 | 예정 |

## 완료 조건

- [x] 로그인 화면 와이어프레임
- [x] 대시보드 와이어프레임
- [ ] 검색 필터 구현

## 참고 코드

```ts
function signIn(email: string, password: string) {
  return api.post("/auth/login", { email, password });
}
```

> 이 문서를 수정하면 Manifast 가 ~300ms 내에 자동으로 다시 렌더합니다.
