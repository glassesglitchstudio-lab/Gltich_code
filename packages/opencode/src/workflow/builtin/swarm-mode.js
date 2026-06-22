export const meta = {
  name: 'swarm-mode',
  description: 'GlassesCat Swarm — dispatches a task to 3 models in parallel (ultra/standard/lite), compares results, and returns the best solution with a diff analysis.',
  whenToUse: 'Use when a task requires high quality and you want the best result from multiple model perspectives. Ideal for code generation, refactoring, and complex debugging.',
  phases: [
    { title: "Analyze", detail: "Analyze the task and decide the evaluation criteria" },
    { title: "Swarm", detail: "Dispatch to 3 models in parallel — each produces a full solution" },
    { title: "Judge", detail: "Compare all solutions, rank them, explain why one is best" },
    { title: "Deliver", detail: "Return the winning solution with a summary of differences" },
  ],
}

phase("Analyze")
const TASK = (typeof args === "string" && args.trim()) || ""
if (!TASK) return { error: "No task provided. Pass a task description as args." }

const EVAL_SHAPE = {
  type: "object", required: ["criteria"],
  properties: {
    criteria: { type: "array", minItems: 3, maxItems: 6, items: {
      type: "object", required: ["name", "weight"],
      properties: {
        name: { type: "string", description: "Criterion name (correctness, performance, readability, security, etc.)" },
        weight: { type: "number", description: "Importance 1-10" },
      },
    }},
  },
}

const analysis = await agent(
  "You are a senior architect. Analyze the following task and define 3-5 evaluation criteria to judge solutions against.\n" +
  "Task: " + TASK + "\n" +
  "Return an array of criteria with name and weight (1-10).",
  { label: "analyze", phase: "Analyze", schema: EVAL_SHAPE }
)
const criteria = analysis?.criteria || [
  { name: "correctness", weight: 10 },
  { name: "readability", weight: 7 },
  { name: "performance", weight: 6 },
]

log("Evaluation criteria: " + criteria.map(c => c.name + "(" + c.weight + ")").join(", "))

phase("Swarm")

const SOLUTION_SHAPE = {
  type: "object", required: ["solution", "explanation", "confidence"],
  properties: {
    solution: { type: "string", description: "Complete solution (code, text, or structured answer)" },
    explanation: { type: "string", description: "Step-by-step reasoning for this solution" },
    confidence: { type: "number", description: "Confidence score 1-10" },
    caveats: { type: "array", items: { type: "string" }, description: "Potential issues or edge cases" },
  },
}

const models = ["ultra", "standard", "lite"]

const solutions = await parallel(
  models.map(model => () =>
    agent(
      "You are an expert developer. Solve the following task completely and thoroughly.\n" +
      "Task: " + TASK + "\n\n" +
      "Provide your best solution with detailed explanation.",
      {
        label: "swarm-" + model,
        phase: "Swarm",
        model: model,
        schema: SOLUTION_SHAPE,
      }
    )
  )
)

const results = models.map((m, i) => ({ model: m, result: solutions[i] }))
const succeeded = results.filter(r => r.result !== null && r.result.solution)

log("Swarm complete: " + succeeded.length + "/" + models.length + " models produced solutions")

if (succeeded.length === 0) {
  return { error: "All models failed to produce a solution.", results: [] }
}

phase("Judge")

const JUDGE_SHAPE = {
  type: "object", required: ["winner", "ranking", "reasoning"],
  properties: {
    winner: { type: "string", description: "Model name of the winning solution" },
    ranking: { type: "array", items: {
      type: "object", required: ["model", "score", "strengths", "weaknesses"],
      properties: {
        model: { type: "string" },
        score: { type: "number", description: "Overall score 1-10" },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
      },
    }},
    reasoning: { type: "string", description: "Detailed comparison explaining the winner" },
  },
}

const judgePrompt = "You are a senior technical judge. Compare the following " + succeeded.length + " solutions to the task.\n\n" +
  "Task: " + TASK + "\n\n" +
  "Evaluation criteria:\n" + criteria.map(c => "- " + c.name + " (weight: " + c.weight + "/10)").join("\n") + "\n\n" +
  succeeded.map((r, i) =>
    "--- Solution " + (i+1) + " (" + r.model + ") ---\n" +
    "Solution: " + r.result.solution + "\n" +
    "Explanation: " + r.result.explanation + "\n" +
    "Confidence: " + r.result.confidence + "/10\n" +
    "Caveats: " + (r.result.caveats || []).join(", ")
  ).join("\n\n") + "\n\n" +
  "Rank the solutions by quality. Select the winner and explain your reasoning."

const verdict = await agent(judgePrompt, { label: "judge", phase: "Judge", schema: JUDGE_SHAPE })
const winner = succeeded.find(r => r.model === (verdict?.winner || succeeded[0].model)) || succeeded[0]

phase("Deliver")

const deltaRows = succeeded.length > 1 ? succeeded.filter(r => r.model !== winner.model).map(r => {
  const diff = r.result.solution !== winner.result.solution ? "DIFFERS" : "SAME"
  return "- " + r.model + ": " + diff + " (confidence " + r.result.confidence + "/10)"
}).join("\n") : "- Only one solution produced"

return {
  task: TASK,
  winner: winner.model,
  solution: winner.result.solution,
  explanation: winner.result.explanation,
  verdict: verdict?.reasoning || "",
  comparison: {
    criteria: criteria.map(c => c.name),
    ranking: verdict?.ranking || [{ model: winner.model, score: 10, strengths: [], weaknesses: [] }],
    solutionDiff: deltaRows,
  },
  stats: {
    modelsAttempted: models.length,
    modelsSucceeded: succeeded.length,
    finalConfidence: winner.result.confidence || 0,
  },
}
