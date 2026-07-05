---
schema: manifast.doc/1
id: prd-main
type: prd
title: Manifast Demo — Product Requirements
status: active
related: [feat-auth, feat-dashboard]
sources: []
owner: demo
updatedAt: 2026-06-24
---

## Background

This document is the **example PRD** seeded by `manifast init`. It shows how
Manifast renders Markdown + frontmatter documents.

## Goals

- Provide email/password login
- Provide a dashboard that shows the key metrics at a glance

## Scope

| Feature | Priority | Status |
|---|---|---|
| Login | High | In progress |
| Dashboard | High | Done |
| Search filter | Low | Planned |

## Done criteria

- [x] Login screen wireframe
- [x] Dashboard wireframe
- [ ] Search filter implementation

## Detailed spec

- [User authentication](../specs/feat-auth.md) — login flow and validation rules
- [Dashboard](../specs/feat-dashboard.md) — metric cards and table layout

## Reference code

```ts
function signIn(email: string, password: string) {
  return api.post("/auth/login", { email, password });
}
```

> When you edit this document, Manifast automatically re-renders it within ~300ms.
