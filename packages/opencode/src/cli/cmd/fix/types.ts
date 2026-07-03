export interface GitHubIssue {
  number: number
  title: string
  body: string
  labels: string[]
  author: string
  state: "open" | "closed"
  url: string
}

export interface TriageResult {
  issue: GitHubIssue
  issueType: "bug" | "feature" | "enhancement" | "chore" | "unknown"
  priority: "high" | "medium" | "low"
  summary: string
}

export interface ResolutionPlan {
  steps: string[]
  filesToModify: string[]
  filesToCreate: string[]
  assumptions: string[]
}

export interface DiscoveredFile {
  path: string
  action: "modify" | "create" | "delete" | "no_change"
  reason: string
}

export interface FileContent {
  path: string
  content: string | null
  sha?: string
  isNew: boolean
}

export interface CodeProposal {
  file_path: string
  action: "modify" | "create" | "delete" | "no_change"
  code?: string
  explanation?: string
}

export interface ReviewIssue {
  file: string
  line: number
  message: string
  severity: "error" | "warning" | "info"
}

export interface ReviewFeedback {
  reviewer: "technical" | "style" | "security"
  approved: boolean
  score: number
  feedback: string
  suggestions: string[]
  issues: ReviewIssue[]
}

export interface ApplyResult {
  success: boolean
  filesChanged: string[]
  errors: string[]
}

export interface GitOpsResult {
  branch: string
  commitSha?: string
  prUrl?: string
  pushed: boolean
}

export interface FixContext {
  issueUrl: string
  owner: string
  repo: string
  issueNumber: number
  issue: GitHubIssue
  triage: TriageResult
  plan: ResolutionPlan
  discoveredFiles: DiscoveredFile[]
  originalContents: FileContent[]
  proposals: CodeProposal[]
  reviews: ReviewFeedback[]
  applyResult: ApplyResult
  gitResult: GitOpsResult
  dryRun: boolean
  debateMode: boolean
  maxReviewCycles: number
  model?: string
}

export interface FixOptions {
  issueUrl: string
  model?: string
  targetFile?: string
  maxReviewCycles: number
  noPr: boolean
  dryRun: boolean
  debateMode: boolean
  autoCommit: boolean
}
