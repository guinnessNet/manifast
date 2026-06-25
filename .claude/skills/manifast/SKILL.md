---
name: manifast
description: Use when designing or editing UI wireframes, PRDs, feature specs, task boards, or implementation plans for a project that has a .manifast/ folder. Manifast is a local viewer that visualizes these files; you author them as structured JSON + Markdown so the user can see wireframes, docs, a kanban board, and a roadmap with live reload.
---

# Manifast authoring skill

Manifast is a **local, read-only** tool. It renders the files in `.manifast/`.
You (the agent) are the only writer. When the user asks you to design screens or
write product docs, create/modify the files described here. Keep every file a
**valid** JSON or Markdown-with-frontmatter document at all times — the viewer
shows a red error banner for any file it can't parse, but keeps rendering the
rest.

## 1. Folder layout (one file per item)

```
.manifast/
  manifast.json            # project meta (optional)
  schema/*.json            # JSON Schema (validation contract — do not edit)
  wireframes/<id>.json     # ONE screen per file  (id should match filename)
  prd/prd.md               # the PRD (Markdown + YAML frontmatter)
  specs/<feature-id>.md    # ONE feature spec per file
  tasks/tasks.json         # the whole task board (single file)
  plan/plan.json           # the implementation plan/roadmap (single file)
```

Rules: one screen per file in `wireframes/`, one spec per file in `specs/`.
`tasks.json` and `plan.json` are each a single file holding everything. Put
files only in these folders — never absolute paths or arbitrary locations. The
JSON Schemas in `.manifast/schema/*.json` are the authoritative contract.

## 2. Wireframe schema (`wireframes/<id>.json`)

```jsonc
{
  "schema": "manifast.wireframe/1",
  "id": "screen-login",          // match the filename
  "name": "Login",               // display name
  "device": "mobile",            // "desktop" | "tablet" | "mobile"
  "size": { "w": 390, "h": 844 },// canvas size in px
  "background": "#FFFFFF",        // optional
  "root": [ /* WireNode[] */ ]
}
```

**Coordinates:** every node has `frame: { x, y, w, h }` in pixels, **relative to
its parent** (root nodes are relative to the screen). The renderer nests
children with the parent positioned relatively, so moving a Box moves its
children. Keep sibling frames from overlapping (use the recommended sizes).

**Node catalog — exactly these 18 `type`s, nothing else:**

| type | required | optional |
|---|---|---|
| `Box` | — | `variant`: card\|section\|plain · `children`: WireNode[] |
| `Text` | `content` | `role`: h1\|h2\|h3\|body\|caption\|label · `align`: left\|center\|right |
| `Button` | `label` | `variant`: primary\|secondary\|ghost · `size`: sm\|md\|lg |
| `Input` | — | `label` · `placeholder` · `kind`: text\|search\|password\|email\|number |
| `Textarea` | — | `label` · `placeholder` · `rows` (default 3) |
| `Checkbox` | — | `label` · `checked` |
| `Radio` | — | `label` · `checked` |
| `Toggle` | — | `label` · `on` |
| `Select` | — | `label` · `placeholder` · `options`: string[] |
| `Image` | — | `ratio` (e.g. "16:9") · `label` (default "Image") |
| `Avatar` | — | `shape`: circle\|square |
| `Icon` | `name` (lucide icon) | `size` (default 24) |
| `Divider` | — | `orientation`: horizontal\|vertical |
| `Badge` | `label` | `tone`: neutral\|info\|success\|warning\|danger |
| `Navbar` | — | `brand` · `links`: string[] · `actions`: string[] |
| `Table` | `columns`: string[] | `rows` (default 5) |
| `List` | — | `items` (default 5) · `withAvatar` · `withIcon` |
| `Tabs` | `tabs`: string[] | `activeIndex` (default 0) |

Every node also needs `id`, `type`, `frame`. **Only `Box` may have `children`.**
`Navbar`/`Table`/`List`/`Tabs` draw themselves from their props (no children).

**Recommended default sizes (px):** Button 120×40 · Input/Textarea/Select 280×40
· Navbar (screen width)×64 · Avatar 40×40 · Icon 24×24 · Divider (parent width)×1
· Table 44/row · List 56/item.

## 3. PRD / spec (`prd/prd.md`, `specs/<id>.md`)

YAML frontmatter + Markdown body (GFM: tables, task lists, code blocks):

```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec            # "prd" | "spec"
title: User authentication
status: active        # "draft" | "active" | "done" (default draft)
wireframe: screen-login   # optional — link to a wireframe id
tasks: [task-1, task-2]   # optional — linked task ids
updatedAt: 2026-06-24     # optional
---

## Background
...free Markdown...
```

`schema`, `id`, `type`, `title` are required. Bad frontmatter is a non-fatal
warning (the body still renders) — but keep it valid.

## 4. Task board (`tasks/tasks.json`)

```json
{
  "schema": "manifast.tasks/1",
  "tasks": [
    {
      "id": "task-1",
      "title": "Build login form",
      "status": "in_progress",
      "priority": "high",
      "specId": "feat-auth",
      "wireframeId": "screen-login",
      "deps": []
    }
  ]
}
```

`status` ∈ todo | in_progress | done | blocked (the 4 fixed kanban columns).
`priority` ∈ low | med | high (default med). `specId`, `wireframeId`, `deps`
are optional links.

## 5. Plan / roadmap (`plan/plan.json`)

```json
{
  "schema": "manifast.plan/1",
  "phases": [
    { "id": "p1", "name": "MVP auth", "goal": "login/signup",
      "status": "active", "taskIds": ["task-1", "task-2"] }
  ]
}
```

`status` ∈ planned | active | done (default planned). Each phase links tasks via
`taskIds`.

## 6. Links (single source of truth — no duplication)

| link | where it lives |
|---|---|
| spec → wireframe | spec frontmatter `wireframe` |
| spec → tasks | spec frontmatter `tasks[]` |
| task → spec / screen | task `specId` / `wireframeId` |
| task → task (prereq) | task `deps[]` |
| plan → tasks | phase `taskIds[]` |

Reference ids that actually exist (the viewer greys out broken links).

## 7. Few-shot example

`.manifast/wireframes/screen-login.json`
```json
{
  "schema": "manifast.wireframe/1",
  "id": "screen-login", "name": "Login", "device": "mobile",
  "size": { "w": 390, "h": 844 }, "background": "#FFFFFF",
  "root": [
    { "id": "t", "type": "Text", "frame": { "x": 24, "y": 96, "w": 342, "h": 36 },
      "content": "Login", "role": "h1" },
    { "id": "email", "type": "Input", "frame": { "x": 24, "y": 160, "w": 342, "h": 44 },
      "label": "Email", "placeholder": "you@example.com", "kind": "email" },
    { "id": "pw", "type": "Input", "frame": { "x": 24, "y": 224, "w": 342, "h": 44 },
      "label": "Password", "kind": "password" },
    { "id": "go", "type": "Button", "frame": { "x": 24, "y": 296, "w": 342, "h": 48 },
      "label": "Sign in", "variant": "primary", "size": "lg" }
  ]
}
```

`.manifast/specs/feat-auth.md`
```markdown
---
schema: manifast.doc/1
id: feat-auth
type: spec
title: User authentication
status: active
wireframe: screen-login
tasks: [task-1]
---

## Goal
Email/password login.
```

`.manifast/tasks/tasks.json`
```json
{ "schema": "manifast.tasks/1",
  "tasks": [ { "id": "task-1", "title": "Build login form", "status": "in_progress",
    "priority": "high", "specId": "feat-auth", "wireframeId": "screen-login" } ] }
```

## 8. Don't

- Don't invent node `type`s outside the 18-item catalog.
- Don't put `children` on anything except `Box`.
- Don't write files outside `.manifast/` or use absolute paths.
- Don't edit `.manifast/schema/*.json` (generated contract).
- Don't leave a file as invalid JSON/frontmatter. After edits, bump `updatedAt`.
