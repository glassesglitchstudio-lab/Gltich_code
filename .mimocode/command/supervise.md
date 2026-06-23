---
title: "/supervise"
description: "GlassesCat Auto-Supervision — run self-supervision on the last task"
group: "GlassesCat"
---

Run the self-supervision tool on the current session to check for:
- 🔍 Subagent errors (error patterns, crashes, exceptions)
- ⚠️ Agent flaws (TODO, @ts-ignore, hardcoded values)
- 🎯 Prompt quality (short/ambiguous prompts)
- 🛡️ Consistency check (plan vs output mismatch)

Usage: /supervise [mode]

Modes:
- `all` (default) — runs all 4 checks
- `scan` — subagent error scan only
- `flaws` — agent flaw review only
- `audit` — prompt audit only
- `consistency` — consistency check only
