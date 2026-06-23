---
name: pattern-learner
description: GlassesCat Pattern Learner — scans codebase for anti-patterns, duplicate code, and style inconsistencies
---

# Pattern Learner

Analyzes code quality by detecting repeated patterns and anti-patterns across the codebase.

## Detection Capabilities

### Anti-Patterns (10 types)
| Pattern | Severity | Description |
|---------|----------|-------------|
| `any-usage` | medium | TypeScript `any` disables type checking |
| `console-log` | low | Debug logging in production |
| `long-function` | medium | Functions > 50 lines |
| `magic-number` | low | Hardcoded numeric literals |
| `nested-callback` | high | Callback nesting > 3 levels |
| `todo-leftover` | low | TODO/FIXME in committed code |
| `duplicate-code` | medium | Similar code blocks > 5 lines |
| `mutating-props` | high | Direct parameter mutation |
| `empty-catch` | high | Swallowing errors silently |
| `sync-io` | medium | Blocking calls in async context |

### Duplicate Function Detection
- Finds identical functions across different files
- Suggests extraction into shared utilities
- Reports occurrence count and file locations

## When to Use

- Before a major refactoring session
- When reviewing code quality
- After merging a large PR
- Onboarding to a new codebase
- Setting up code quality benchmarks

## Usage

```
pattern-learner(scope="file|project|history", pattern_type="duplicates|antipatterns|all", limit=<number>)
```
