---
name: manifast-workflow
description: End-to-end feature development workflow for Manifast projects — Brainstorm (design) → Plan (dialectical thesis-antithesis-synthesis verification) → Implement (subagent-per-task + Manifast doc updates). Run phases in order or jump to any phase independently.
---

# Manifast development workflow

Automates the entire feature-development process in three phases. Each phase can run independently, and running them in order chains design → verified plan → implementation → automatic doc updates.

```
Brainstorm → Write Plan (dialectical verification) → Implement (subagents + Manifast updates)
```

---

## PHASE 1 — Brainstorm (design exploration)

> Based on the Superpowers brainstorming skill. Lock down the design before writing a single line of code.

**Opening declaration:** "Starting Manifast workflow Phase 1 — Brainstorm."

### Hard gate

No code writing, scaffolding, or implementation of any kind until the design is approved. No exceptions, even for simple tasks.

### Sequence

**1. Understand the project context**
- Read all of `.manifast/` (prd, specs, tasks, plan, diagrams)
- Assess the current task status and roadmap stage
- Review recent commits and change history

**2. Explore requirements (one question at a time)**
- Identify the goal, constraints, and success criteria
- One question per message — no multiple questions
- Present multiple-choice options where possible, with a recommendation

**3. Propose 2–3 approaches**
- State the trade-offs of each approach
- Present the recommended approach and the reasoning
- Eliminate over-engineering (YAGNI violations)

**4. Write the design document**
- After the design is approved, save it to `.manifast/specs/<YYYY-MM-DD>-<feature-id>.md`
- frontmatter: `schema · id · type: spec · title · status: draft · sources: [] · owner`
- Sections: Goals · Architecture · Components · Data flow · Error handling · Test strategy

**5. Self-review the design**
- Check for no TBDs, TODOs, or empty sections
- Check for internal contradictions
- Confirm the scope fits a single implementation plan
- Fix any issues found immediately

**6. Request user review**
> "I've saved the design document to `.manifast/specs/<path>`. Review it and let me know whether to move on to writing the plan."

**→ On approval, proceed to PHASE 2**

---

## PHASE 2 — Write Plan with dialectical verification

> Based on Superpowers writing-plans + **verify the plan with the 正反合 (thesis-antithesis-synthesis) dialectic**.
> The agent attacks and synthesizes its own plan to guarantee quality.

**Opening declaration:** "Starting Manifast workflow Phase 2 — dialectical plan verification."

### Thesis (正) — Draft the plan

**Map the file structure**
- Define the files to create/modify and each one's responsibility
- Finalize the interfaces between files (function names, types, return values)

**Break down into tasks**
- Each task = the smallest independently testable unit
- Each step is 2–5 minutes of work (TDD: write failing test → confirm failure → implement → confirm pass → commit)
- **Always include a Manifast update task** (tasks.json · plan.json · specs · diagrams)

**Plan document header (required)**

```markdown
# [feature name] implementation plan

> **For agent workers:** execute this plan task by task.
> After completing each task, always run the `manifast-checklist` skill.

**Goal:** [one sentence]
**Architecture:** [2–3 sentences]
**Tech stack:** [core technologies/libraries]

## Global constraints
[requirements that apply across the whole project — versions, naming, platform, etc.]

---
```

**Task structure (no placeholders)**

```markdown
### Task N: [component name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Provides: [what later tasks depend on — exact function names/types]

- [ ] Write failing test
- [ ] Confirm failure (`pytest ...` or the relevant test runner)
- [ ] Write minimal implementation
- [ ] Confirm pass
- [ ] Commit (`git add ... && git commit -m "feat: ..."`)
- [ ] **Run the Manifast checklist** (update tasks.json · plan.json · affected docs)
```

---

### Antithesis (反) — Critique the plan

After the draft is complete, **the same agent switches into the role of critic** and attacks the plan.

Answer each question below in turn to surface problems:

1. **Failure scenarios**: "In what situations does this plan fail? Which edge cases are missing?"
2. **Assumption check**: "What did we take for granted without evidence? How could it be wrong?"
3. **Over-design**: "YAGNI violations — what's included that isn't needed right now?"
4. **Under-design**: "What will require a major refactor later?"
5. **Interface mismatch**: "Where do types or function names not line up between tasks?"
6. **Missing Manifast updates**: "Where did we skip a Manifast update after completing a task?"
7. **Test gaps**: "Which tasks have no tests or meaningless ones?"
8. **Ordering problems**: "Which task pairs have the wrong dependency order?"

Organize the surfaced problems into a **critique list**:

```
## Antithesis (反) critique list
- [CRITICAL] ...
- [IMPORTANT] ...
- [MINOR] ...
```

---

### Synthesis (合) — Finalize the plan

Review the critique list, revise the plan, and record the reasons for each change.

```markdown
## Dialectical verification results

### Critiques applied
- [critique item] → [how it was fixed]

### Critiques rejected (reasons)
- [critique item] → [rejection reason: YAGNI / out of scope / already handled / ...]
```

**Save the final plan:** `docs/plans/<YYYY-MM-DD>-<feature-id>-plan.md`

**Request user review:**
> "Dialectical verification complete. I've saved the plan to `<path>`. Shall I start implementation after your review?"

**→ On approval, proceed to PHASE 3**

---

## PHASE 3 — Implement (subagent execution)

> Based on Superpowers subagent-driven-development. Dispatch a fresh subagent per task, and only move to the next task after passing the review gate.

**Opening declaration:** "Starting Manifast workflow Phase 3 — subagent implementation."

### Principles

- **A fresh subagent per task** — no contamination from prior session context
- **No interim reports to the user** — proceed only when a task is done and its review passes
- **Stop immediately on a blocker** — don't guess, report

### Sequence for each task

```
1. Prepare the task brief (extract that task's text from the plan file)
2. Dispatch the implementation subagent
   - Pass: task brief + global constraints + earlier tasks' interfaces
   - Forbidden: passing the whole plan file at once (pass only that task)
3. Handle the subagent's questions, then proceed with implementation
4. Confirm the completion report:
   - Implementation code committed
   - Tests pass (results included)
   - manifast-checklist run completed
5. Dispatch the review subagent (pass the diff file)
   - Review items: spec compliance + code quality
6. Review passes → next task / fails → dispatch a fix subagent
```

### Implementation subagent dispatch prompt structure

```
Context: [one line on where this task sits in the whole]
Brief: [the full task text]
Global constraints: [the plan's Global Constraints section verbatim]
Earlier task interfaces: [the functions/types this task will use — exact signatures]
Report save path: [task-N-report.md]

After completion, always:
1. Include test run results
2. Run manifast-checklist (update tasks.json·plan.json)
3. Report status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
```

### Handling by status

| Status | Handling |
|---|---|
| `DONE` | Generate diff → dispatch review subagent |
| `DONE_WITH_CONCERNS` | Review the concerns, then proceed to review or fix |
| `NEEDS_CONTEXT` | Supply the missing context, then re-dispatch |
| `BLOCKED` | Find the cause → resolve via one of: context / model / task breakdown |

### Progress ledger (in case of context compaction)

```
.manifast/workflow-progress.md
---
Task 1: done (commit <hash>, review passed)
Task 2: done (commit <hash>, review passed)
Task 3: in progress
```

- On restart, read this file first to skip completed tasks
- Never re-dispatch a completed task

### After everything is complete

1. Final code review (full branch diff)
2. Check `tasks.json` that all tasks are done
3. Update `plan.json` if any phase is complete
4. Delete `.manifast/workflow-progress.md`
5. Report completion to the user

---

## Running phases independently

Each phase can be started independently:

- **Design only**: "Manifast workflow Phase 1 — Brainstorm"
- **Plan only**: "Manifast workflow Phase 2 — Write Plan (with dialectical verification)"
- **Implementation only**: "Manifast workflow Phase 3 — Implement" (requires the plan file path)

---

## Core principles

- **YAGNI**: don't design or implement what isn't needed now
- **Design first**: lock down the design before a single line of code
- **Dialectic**: always attack and verify the plan yourself
- **Fresh context**: subagents receive only what they need
- **Manifast sync**: run the checklist on every task completion
