---
name: manifast-checklist
description: Run after every code change to keep Manifast documents (tasks, plan, specs, diagrams) in sync with the implementation. Attach to any coding task.
---

# Manifast task completion checklist

**Run this checklist every time you finish a code change.**
Keep the Manifast viewer accurately reflecting the current implementation state.

---

## Required items

- [ ] **1. Update task status** (`.manifast/tasks/tasks.json`)
  - Completed task → `"status": "done"`
  - New work found along the way → add a new item (`"status": "todo"`, new `id`)
  - On a blocker → `"status": "blocked"` (record the reason in the title)

- [ ] **2. Update roadmap progress** (`.manifast/plan/plan.json`)
  - All of a phase's `taskIds` are done → phase `"status": "done"`
  - Next phase starts → `"status": "active"`

- [ ] **3. Check for sources drift**
  1. Identify the list of files I modified/added
  2. Find `.manifast/` or `docs/` documents that list those files in `sources`
  3. Compare the document body against the current code — apply the stale criteria below
  4. If stale → refresh frontmatter `updatedAt` + report the list of body edits needed

  **Stale criteria:**
  - A function, class, or file the document mentions was deleted or renamed
  - The behavior the document describes differs from the current code
  - A `sources` file was heavily refactored

- [ ] **4. Document new features/modules**
  - When adding a new feature, service, or module, create `.manifast/specs/<feature-id>.md`
  - Required frontmatter: `schema · id · type: spec · title · status: active · sources: [files you added]`
  - Recommended: set `reviewBy` (review cadence) and `owner`

- [ ] **5. Update architecture diagrams**
  - When adding a new component/service or changing relationships, update `.manifast/diagrams/`
  - Add new nodes/edges, remove deleted nodes/edges, refresh `generatedAt`

---

## Quick drift-detection sequence (headless)

```
1. Check the list of modified files (git diff --name-only or your work log)
2. Grep the sources field for each filename → find linked documents
3. Open tasks.json and reflect completed/new tasks
4. Open plan.json and reflect phase progress
5. If it's a new feature, create a specs/ file
6. If the architecture changed, update diagrams/
```

When done, check the Tasks · Plan · Map views in the Manifast viewer (`manifast <project>`).
