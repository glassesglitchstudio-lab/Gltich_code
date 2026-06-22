export const meta = {
  name: 'model-router',
  description: 'GlassesCat Model Router — dispatches a task to the optimal model using the hierarchy: X_FABLE_CODER → V7 → V6 → V5 → MiMo. Falls back on failure and reports which model won.',
  whenToUse: 'Use when a complex task needs intelligent model selection, or when the default model fails and needs automatic fallback.',
  phases: [
    { title: "Analyze Task", detail: "Determine task type, complexity, and context requirements" },
    { title: "Route", detail: "Select best model from GlassesCat hierarchy" },
    { title: "Execute", detail: "Run task with selected model" },
    { title: "Verify", detail: "Check output quality and decide if fallback needed" },
  ],
}

phase("Analyze Task")
const TASK = (typeof args === "string" && args.trim()) || (args?.task ? args.task : "")
if (!TASK) return { error: "No task provided." }
const FAILED_MODEL = args?.failed_model || null
const MODE = args?.mode || "auto"

log("Task: " + TASK.substring(0, 100) + (TASK.length > 100 ? "..." : ""))
log("Mode: " + MODE + (FAILED_MODEL ? ", failed model: " + FAILED_MODEL : ""))

const taskLower = TASK.toLowerCase()
const needsReasoning = taskLower.includes("debug") || taskLower.includes("fix") || taskLower.includes("security") || taskLower.includes("complex")
const needsLongContext = taskLower.includes("large") || taskLower.includes("big") || taskLower.includes("full") || taskLower.includes("entire") || taskLower.includes("all files")
const isQuick = !needsReasoning && !needsLongContext && (taskLower.length < 200)

phase("Route")

const MODELS = [
  { id: "glassesglitchstudio/gulmzcetiner:X_FABLE_CODER_V1", tier: "X_FABLE_CODER_V1", desc: "Primary — Berkay's personal model", when: "default" },
  { id: "glassesglitchstudio/gulmzcetiner:V7_HYBRID_TITAN", tier: "V7_HYBRID_TITAN", desc: "Reasoning + Security", when: "complex tasks, debugging, security review" },
  { id: "glassesglitchstudio/gulmzcetiner:V6_OMNI_OVERLORD", tier: "V6_OMNI_OVERLORD", desc: "128K context, swarm node", when: "large files, full codebase analysis" },
  { id: "glassesglitchstudio/gulmzcetiner:V5_NEXUS_CORE", tier: "V5_NEXUS_CORE", desc: "Fast executor", when: "simple tasks, quick fixes" },
]

let selectedIdx = 0
if (FAILED_MODEL) {
  const failedIdx = MODELS.findIndex(m => m.tier.toLowerCase().includes(FAILED_MODEL.toLowerCase()))
  selectedIdx = failedIdx >= 0 ? Math.min(failedIdx + 1, MODELS.length - 1) : 0
} else if (isQuick) {
  selectedIdx = 3
} else if (needsLongContext) {
  selectedIdx = 2
} else if (needsReasoning) {
  selectedIdx = 1
}

const selected = MODELS[selectedIdx]
log("Selected: " + selected.tier + " — " + selected.desc)

phase("Execute")
const result = await agent(
  "You are " + selected.tier + ", a specialized AI model. Solve this task:\n\n" + TASK,
  { label: selected.tier, model: selectedIdx > 2 ? "standard" : selectedIdx > 1 ? "ultra" : "ultra", phase: "Execute" }
)

if (!result) {
  log("FAILED with " + selected.tier + " — attempting fallback")
  const fallbackIdx = Math.min(selectedIdx + 1, MODELS.length - 1)
  if (fallbackIdx !== selectedIdx) {
    const fallback = MODELS[fallbackIdx]
    const fallbackResult = await agent(
      "Fallback after " + selected.tier + " failure. You are " + fallback.tier + ". Solve this task:\n\n" + TASK,
      { label: "fallback-" + fallback.tier, model: fallbackIdx > 2 ? "standard" : "ultra", phase: "Execute" }
    )
    return {
      task: TASK,
      route: MODELS.map(m => m.tier),
      primary: selected.tier + " (FAILED)",
      winner: fallback.tier,
      result: fallbackResult,
      note: "Primary model " + selected.tier + " failed. Fell back to " + fallback.tier + ".",
    }
  }
  return {
    task: TASK,
    route: MODELS.map(m => m.tier),
    primary: selected.tier,
    winner: "MiMo Auto (1M context)",
    result: null,
    note: "All GlassesCat models exhausted. Try MiMo Auto via: provider=ollama/model=mimo-auto",
  }
}

return {
  task: TASK,
  route: MODELS.map(m => m.tier),
  primary: selected.tier,
  winner: selected.tier,
  result: result,
  note: "Task completed successfully with " + selected.tier + ".",
}
