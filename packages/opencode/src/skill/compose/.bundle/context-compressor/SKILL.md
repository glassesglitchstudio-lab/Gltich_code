---
name: context-compressor
description: GlassesCat Context Compressor — summarizes long sessions to save context window and preserve key information
---

# Context Compressor

Compresses long conversation sessions into concise markdown summaries, preserving decisions, TODOs, and key changes.

## Features

- **Session Summarization**: Condenses entire sessions into digestible format
- **Key Decisions**: Extracts architectural and design decisions
- **TODO Extraction**: Identifies pending work items
- **Code Change Tracking**: Logs files modified and changes made
- **Error Logging**: Captures errors encountered during the session
- **File Output**: Optionally writes compressed summary to a file

## Output Formats

- `summary`: Paragraph-style narrative summary
- `bullets`: Bullet-point key items
- `structured`: Categorized sections (decisions, changes, errors, todos)

## When to Use

- Context window is getting full (long session)
- Before starting a new major task in the same session
- At the end of a work session for documentation
- When switching between complex tasks
- To share session context with another agent or team member

## Usage

```
context-compressor(session_id="<optional>", format="summary|bullets|structured", include_decisions=true, include_todos=true, output_path="<optional file path>")
```
