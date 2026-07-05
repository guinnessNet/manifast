---
name: implement
description: Use after write-plan to execute the implementation plan task by task. Dispatches a fresh subagent per task, runs a review gate after each, and automatically runs the manifast-checklist to keep tasks.json, plan.json, and specs in sync with the code.
---

# Implement — Subagent Implementation Skill

Execute the plan file task by task. Dispatch a fresh subagent for each task, and only move on once it passes the review gate.

**Opening statement:** "Implement: [plan file path]"

---

## Principles

- **A fresh subagent per task** — no contamination from previous session context
- **Stop immediately when a blocker appears** — report it, don't guess
- **Run the Manifast checklist when all tasks are done** — sync tasks.json and plan.json

---

## Execution order for each task

```
1. Extract that task's text from the plan file
2. Dispatch an implementation subagent
   Pass: task brief + global constraints + earlier tasks' interfaces
   Do not: pass the entire plan file wholesale
3. Confirm implementation is complete:
   - Code committed
   - Tests pass (include results)
   - Manifast checklist run
4. Dispatch a review subagent (pass the diff)
   Review: spec compliance + code quality
5. Review passes → next task / fails → fix subagent
```

---

## Subagent dispatch prompt structure

```
Context: [one line on where this task sits in the whole]
Brief: [full task text]
Global constraints: [the plan's Global Constraints section]
Earlier task interfaces: [functions/types to use — exact signatures]
Report save path: docs/plans/task-N-report.md

After completing, always:
1. Include test run results
2. Run the Manifast checklist (update tasks.json·plan.json)
3. Report status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
```

---

## Handling by status

| Status | Handling |
|---|---|
| `DONE` | Generate diff → review subagent |
| `DONE_WITH_CONCERNS` | Review the concerns, then review or fix |
| `NEEDS_CONTEXT` | Supply the missing context, then re-dispatch |
| `BLOCKED` | Find the cause → report, then stop |

---

## Progress ledger (for context compaction)

On restart, read `.manifast/workflow-progress.md` first and skip completed tasks.

```markdown
# Workflow Progress
Task 1: Done (commit <hash>, review passed)
Task 2: Done (commit <hash>, review passed)
Task 3: In progress
```

Never re-dispatch a completed task.

---

## After everything is complete

1. Final code review (whole-branch diff)
2. Check `tasks.json` that all tasks are done
3. Update `plan.json` if any phase is complete
4. Delete `.manifast/workflow-progress.md`
5. Report completion to the user
