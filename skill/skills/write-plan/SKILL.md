---
name: write-plan
description: Use after brainstorming to write a detailed implementation plan. Uses dialectical thesis-antithesis-synthesis reasoning — the agent writes a plan, attacks it with 8 critical questions, then synthesizes a verified final plan. Requires user approval before implementation.
---

# Write Plan — Dialectical Plan Verification Skill

Attack and verify your own draft plan to guarantee quality.

**Opening statement:** "Write Plan: [spec file path or feature name]"

---

## Thesis — Write the draft plan

**Map the file structure**
- Define the files to create/modify and each one's responsibility
- Lock down the interfaces between files (function names, types, return values)

**Task decomposition rules**
- Each task = the smallest independently testable unit
- Order: failing test → implementation → confirm passing → commit → Manifast checklist
- **Always include a Manifast update task** (tasks.json · plan.json · specs · diagrams)

**Plan document header (required)**

```markdown
# [feature name] Implementation Plan

> **For agent workers:** After completing each task, always run manifast-checklist.

**Goal:** [one sentence]
**Architecture:** [2–3 sentences]
**Tech stack:** [core technologies/libraries]

## Global constraints
[requirements that apply to the whole project]

---
```

**Task structure**

```markdown
### Task N: [component name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py`

**Interfaces:**
- Consumes: [functions/types from earlier tasks — exact signatures]
- Provides: [functions/types later tasks will depend on]

- [ ] Write a failing test
- [ ] Confirm it fails
- [ ] Write the minimal implementation
- [ ] Confirm it passes
- [ ] Commit
- [ ] **Run the Manifast checklist**
```

---

## Antithesis — Critique the plan

After finishing the draft, **switch into the critic's role** and attack the plan with the following 8 questions:

1. **Failure scenarios**: In what situations does this plan fail? Which edge cases are missing?
2. **Assumption checks**: What did you assume without evidence? How might it be wrong?
3. **Over-engineering**: YAGNI violations — what's included that isn't needed right now?
4. **Under-engineering**: What will require a big refactor later?
5. **Interface mismatches**: Where do types/function names not line up between tasks?
6. **Missing Manifast**: Where did you leave out a Manifast update after a task completes?
7. **Test gaps**: Which tasks have no test or a meaningless one?
8. **Ordering problems**: Which task pairs are in the wrong dependency order?

Critique list format:
```markdown
## Antithesis critique list
- [CRITICAL] ...
- [IMPORTANT] ...
- [MINOR] ...
```

---

## Synthesis — Finalize the plan

Revise the plan to reflect the critique list and record the reasoning:

```markdown
## Dialectical verification results

### Critiques incorporated
- [critique item] → [what was changed]

### Critiques rejected (with reasons)
- [critique item] → [reason for rejection: YAGNI / out of scope / already handled]
```

**Save to:** `docs/plans/<YYYY-MM-DD>-<feature-id>-plan.md`

**Request user review:**
> "Dialectical verification complete. I've saved the plan to `<path>`. Shall I proceed to `/implement` after your review?"
