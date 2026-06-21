# Linear issue templates

Version-controlled bodies for the **arkon** team's Linear issue templates.
Linear doesn't expose template creation through its API, so these are created
once in the UI and pasted from here.

## Setup (one-time, in Linear)

1. **Settings → Teams → arkon → Templates → Issue templates → + New template.**
2. For each template below, set:
   - **Template name** — the heading (e.g. "Feature")
   - **Title** — the prefix (e.g. `feat: `)
   - **Label** — per the table
   - **Project** — `arkon`
   - **Status** — Todo (optional)
   - **Description** — the body block
3. Set the **Feature** template as the team default (template ⋯ menu → *Set as
   default*) so new issues start pre-labeled `Feature` + project `arkon`.

Prefix → label follows conventional-commit style:

| Title prefix | Label |
| --- | --- |
| `feat:` | Feature |
| `fix:` | Bug |
| `chore:` / `refactor:` / `docs:` / `test:` / `perf:` | Improvement |

> Note: templates are chosen by the issue creator (or via the team default) —
> Linear can't pick one automatically from the title prefix. For fully
> automatic, prefix-keyed labeling you'd need a webhook/Zapier rule instead.

---

## Feature

- **Title prefix:** `feat: `
- **Label:** Feature
- **Project:** arkon

```markdown
## Summary
<one-line description of the feature>

## Motivation
<why — the problem this solves / user need>

## Scope
- <what's included>
- <what's explicitly out of scope>

## Acceptance criteria
- [ ] <observable outcome 1>
- [ ] <observable outcome 2>

## Notes
<links, design refs, open questions>
```

---

## Bug

- **Title prefix:** `fix: `
- **Label:** Bug
- **Project:** arkon

```markdown
## What's wrong
<observed behavior>

## Expected
<what should happen instead>

## Repro
1. <step>
2. <step>

## Environment
<browser / OS / build or commit, if relevant>

## Notes
<stack traces, screenshots, suspected cause>
```

---

## Chore / Improvement

- **Title prefix:** `chore: ` (or `refactor:` / `docs:` / `test:` / `perf:`)
- **Label:** Improvement
- **Project:** arkon

```markdown
## Summary
<what's changing and why>

## Scope
- <what's included>
- <what's out of scope>

## Acceptance criteria
- [ ] <observable outcome>

## Notes
<links, follow-ups>
```
