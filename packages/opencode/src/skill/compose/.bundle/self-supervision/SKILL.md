---
name: self-supervision
description: GlassesCat Auto-Supervision — audits AI outputs for errors, flaws, prompt quality, and consistency
---

# Self-Supervision

Enables the AI to audit its own work across four dimensions.

## Supervision Modes

### 1. `subagent-scan` — Error Pattern Detection
- Scans subagent outputs for: errors, exceptions, crashes, timeouts
- Catches: permission denied, connection refused, syntax errors, TypeErrors
- Use after any multi-step or subagent task

### 2. `agent-flaws` — Code Quality Review
- Detects: TODO/FIXME/HACK markers, `@ts-ignore`, `console.log` in production
- Flags: hardcoded values, technical debt, type safety bypasses
- Use before committing or merging code

### 3. `prompt-audit` — Prompt Quality Analysis
- Analyzes user prompts for clarity and completeness
- Flags: overly short prompts, ambiguous references, vague action verbs
- Use when a task result seems off or misunderstood

### 4. `consistency-check` — Plan vs Output Alignment
- Compares promises ("I will...") against actual delivery
- Detects contradictions, missing features, incomplete work
- Use after complex refactoring or multi-phase tasks

## When to Use

- After completing a complex task
- Before submitting code changes
- When debugging unexpected behavior
- At the end of a long session
- When the user reports an issue

## Usage

```
self-supervision(mode="subagent-scan|agent-flaws|prompt-audit|consistency-check", depth=<number>)
```
