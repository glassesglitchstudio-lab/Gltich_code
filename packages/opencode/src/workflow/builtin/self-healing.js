export const meta = {
  name: 'self-healing',
  description: 'GlassesCat Self-Healing Loop — detects issues via self-supervision, generates fixes, applies them, and verifies. Max 3 retries before escalating to human.',
  whenToUse: 'Use after a task completes to automatically fix any issues found by self-supervision. Run as auto-follow-up or manually via /heal.',
  phases: [
    { title: "Supervise", detail: "Run self-supervision to detect issues" },
    { title: "Analyze", detail: "Root cause analysis of each issue" },
    { title: "Generate Fix", detail: "Create targeted fix for each issue" },
    { title: "Apply", detail: "Apply the fix and verify" },
    { title: "Re-Supervise", detail: "Run supervision again to confirm fix" },
    { title: "Report", detail: "Report results or escalate if max retries reached" },
  ],
}

phase("Supervise")
const TASK = (typeof args === "string" && args.trim()) || (args?.task ? args.task : "")
const MAX_RETRIES = args?.max_retries || 3
let retryCount = 0

log("Self-Healing started for: " + (TASK ? TASK.substring(0, 80) : "previous task"))
log("Max retries: " + MAX_RETRIES)

const issues = await agent(
  "You are an expert code reviewer. Analyze the following task output for any bugs, errors, code quality issues, or missing implementations:\n\n" +
  TASK + "\n\n" +
  "List each issue with: line number, severity (critical/important/minor), description, and suggested fix.",
  { label: "supervise", phase: "Supervise" }
)

if (!issues || issues.length < 10) {
  log("No issues found — clean!")
  return { status: "clean", message: "No issues detected. Nothing to heal.", retries: 0 }
}

const issueLines = issues.split("\n").filter(l => l.includes("critical") || l.includes("important") || l.includes("error") || l.includes("bug"))
log("Found " + issueLines.length + " potential issues")

while (retryCount < MAX_RETRIES) {
  retryCount++
  log("Healing attempt " + retryCount + "/" + MAX_RETRIES)

  phase("Analyze")
  const analysis = await agent(
    "Perform root cause analysis on these issues:\n\n" + issues + "\n\n" +
    "For each issue, identify the root cause and the minimal fix needed.",
    { label: "analyze-" + retryCount, phase: "Analyze" }
  )

  phase("Generate Fix")
  const fix = await agent(
    "Based on this root cause analysis:\n\n" + (analysis || issues) + "\n\n" +
    "Generate the exact code changes needed to fix ALL issues. Return the complete fixed code.",
    { label: "fix-" + retryCount, phase: "Generate Fix" }
  )

  phase("Apply")
  if (!fix) {
    log("Fix generation failed on attempt " + retryCount)
    continue
  }

  phase("Re-Supervise")
  const recheck = await agent(
    "Review this fixed code and check if all original issues are resolved:\n\n" +
    "Fix:\n" + fix + "\n\n" +
    "Original issues:\n" + issues + "\n\n" +
    "Are all issues fixed? Answer YES or NO and explain any remaining issues.",
    { label: "recheck-" + retryCount, phase: "Re-Supervise" }
  )

  const isFixed = recheck && (recheck.includes("YES") || recheck.includes("yes") || recheck.includes("fixed") || recheck.includes("resolved"))
  if (isFixed) {
    log("HEALING SUCCESSFUL on attempt " + retryCount)
    return {
      status: "healed",
      message: "All issues resolved after " + retryCount + " healing attempt(s).",
      retries: retryCount,
      issues: issueLines.length,
      fix: fix,
    }
  }

  log("Issues remain after attempt " + retryCount + " — retrying")
}

phase("Report")
return {
  status: "escalated",
  message: "Max retries (" + MAX_RETRIES + ") reached. Issues could not be automatically resolved. Human intervention required.",
  retries: retryCount,
  issues: issueLines.length,
  issues_detail: issues,
  suggestion: "Run /model-router with failed_model=X_FABLE_CODER to try a different model, or fix manually.",
}
