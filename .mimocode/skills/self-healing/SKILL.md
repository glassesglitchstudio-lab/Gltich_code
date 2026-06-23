---
name: self-healing
description: GlassesCat Self-Healing Loop — automatically detects, analyzes, fixes, and verifies errors with retry logic
---

# Self-Healing

Automatic error recovery system with a four-phase approach and escalation on failure.

## Healing Phases

1. **Analyze** — Root cause analysis using pattern matching
   - Reference errors → missing files, imports, modules
   - Runtime errors → null checks, undefined values
   - Type errors → interface/type mismatches
   - Performance errors → timeouts, slow operations
   - Security errors → permissions, access denied
   - Syntax errors → malformed code

2. **Generate Fix** — Smart fix strategy selection
   - Each error category has a specific fix strategy
   - Strategies are context-aware and deterministic

3. **Apply** — Execute the fix (optionally auto-apply)

4. **Verify** — Confirm the fix resolved the issue

## When to Use

- An error occurs during development
- A tool returns an unexpected error
- File operations fail
- Build/compile errors
- Permission or access issues

## Features

- Max 3 retry attempts before escalation to human
- Auto-apply mode for unattended operation
- Detailed report of each attempt and phase
- Escalation with suggested next steps when unresolved

## Usage

```
self-healing(issue="<description>", file_path="<optional path>", max_retries=3, auto_apply=false)
```
