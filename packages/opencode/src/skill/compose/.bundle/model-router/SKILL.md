---
name: model-router
description: GlassesCat Model Router — routes tasks to the best AI model based on complexity, context size, and failure recovery
---

# Model Router

Routes tasks to the optimal GlassesCat model using a priority-based hierarchy.

## Model Hierarchy

1. **X_FABLE_CODER_V1** — primary default (Berkay's personal model, general code/chat)
2. **V7_HYBRID_TITAN** — deep reasoning, security analysis, complex debugging
3. **V6_OMNI_OVERLORD** — 128K context, large file analysis, code review
4. **V5_NEXUS_CORE** — fast execution, simple tasks, refactoring
5. **MiMo Auto (1M context)** — last resort fallback

## When to Use

- A task fails with one model — retry with fallback chain
- Task needs specific capability (reasoning, long context, speed)
- Unsure which model to start with
- Complex multi-step task that needs optimal routing

## Routing Modes

- `auto`: Automatically selects best model based on task analysis
- `manual`: User specifies which model to use
- `swarm`: 3 models run in parallel, AI Judge picks best result

## Usage

```
model-router(task="<description>", context_size="small|medium|large", mode="auto|manual|swarm", failed_model="<optional>")
```

## Key Behavior

- X_FABLE_CODER_V1 is always the first choice — the user's personal fine-tuned model
- On failure, automatically escalates to the next model in hierarchy
- Falls back to MiMo Auto after all 4 models are exhausted
