---
name: brainstorm
description: Use when starting a new feature, exploring design options, or deciding how to approach a problem — before writing any code. Explores 2-3 approaches, asks one question at a time, produces a spec doc, and requires user approval before proceeding.
---

# Brainstorm — Design Exploration Skill

Lock down the design before writing a single line of code.

**Opening statement:** "Brainstorm: [feature/problem]"

---

## Hard gate

No code writing, scaffolding, or implementation actions of any kind until the design is approved.

---

## Sequence

**1. Understand the project context**
- Read all of `.manifast/` (prd, specs, tasks, plan, diagrams)
- Understand the current task status and roadmap stage
- Explore related existing code and patterns

**2. Explore requirements (one question at a time)**
- Identify the purpose, constraints, and success criteria
- **Only one question per message** — no multiple questions
- Present as multiple choice when possible, with a recommendation

**3. Propose 2–3 approaches**
- Spell out the trade-offs of each approach
- Present the recommended approach and the reasoning
- Remove over-engineering (YAGNI violations)

**4. Write the design document**
After the design is approved, save it to `.manifast/specs/<YYYY-MM-DD>-<feature-id>.md`.

Required frontmatter:
```yaml
schema: manifast.doc/1
id: <feature-id>
type: spec
title: <feature-name>
status: draft
sources: []
owner: <owner>
```

Required sections: Goals · Architecture · Components · Data flow · Error handling · Test strategy

**5. Self-review**
- Check for no TBDs, TODOs, or empty sections
- Check for internal contradictions
- Check that the scope is enough for a single implementation plan

**6. Request user review**
> "I've saved the design document to `.manifast/specs/<path>`. Please review it and let me know whether to move on to `/write-plan`."
