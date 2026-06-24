---
name: deep-file-analysis
description: GlassesCat Deep File Analysis — comprehensive static analysis of source files including metrics, security, and structure
---

# Deep File Analysis

Performs in-depth static analysis on any source file, providing metrics, security scanning, structure mapping, and quality insights.

## Analysis Categories

### Code Metrics
- Total / code / comment / blank line counts
- Comment ratio
- Average and max line lengths

### Structure Analysis
- Function/method map with line numbers and body lengths
- Class/type/interface definitions
- Import dependency graph (internal vs external)
- TypeScript type definitions and exports
- Nesting depth analysis (max, avg, deep blocks)

### Quality Checks
- Cyclomatic complexity scoring
- Duplicate code block detection
- Unused variable / dead code detection
- Missing error handling (risky operations without try/catch)
- Circular dependency suspicion

### Security Scan
- High severity: eval(), exec(), password/token/secret fields
- Medium severity: innerHTML, SQL injection, child_process, cookies
- Low severity: env vars, localStorage

### Maintenance
- TODO/FIXME/HACK/XXX scanner
- File age and last modification time
- Inline test coverage check (describe/it/test patterns)

## When to Use

- Reviewing unfamiliar code
- Before refactoring a file
- Code review during PRs
- Security audit
- Onboarding to a new codebase
- Understanding a file's full structure

## Usage

```
deep-file-analysis(path="<absolute or relative path>", detailed=false, deep=true)
```
