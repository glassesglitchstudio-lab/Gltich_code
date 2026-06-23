---
name: smart-predict
description: GlassesCat Smart Predict — predicts task completion time, risk factors, and optimal approach
---

# Smart Predict

Analyzes a task and provides time estimates, risk assessment, step-by-step plans, and recommendations.

## Prediction Output

- **Time Estimate**: Low (5-30 min), Medium (1-4 hr), High (1-5 days)
- **Confidence Score**: 0-100% based on complexity and files affected
- **Risk Level**: Low / Medium / High with specific risk factors
- **Step-by-Step Plan**: Tailored to complexity level
- **Recommendations**: Context-aware suggestions

## When to Use

- Starting a new task — estimate effort before beginning
- Planning a sprint or work session
- Deciding between approaches
- Before making a time-sensitive change
- When the user asks "how long will this take?"

## Risk Factors by Level

- **Low**: Minimal risk, well-understood domain
- **Medium**: Moderate complexity, may require refactoring
- **High**: Unfamiliar codebase, cascading failures possible

## Usage

```
smart-predict(task="<description>", files_affected=<number>, complexity="low|medium|high")
```
