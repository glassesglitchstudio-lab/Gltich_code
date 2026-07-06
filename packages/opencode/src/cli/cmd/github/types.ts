export type PRSummary = {
  number: number
  title: string
  body: string
  author: { login: string; name?: string }
  state: string
  baseRefName: string
  headRefName: string
  headRefOid: string
  createdAt: string
  additions: number
  deletions: number
  reviewDecision: string | null
  mergeable: string
  mergeStateStatus: string
  url: string
  labels: { nodes: Array<{ name: string; color: string }> }
  reviews: { nodes: Array<{
    author: { login: string }
    state: string
    body: string
    submittedAt: string
  }> }
  commits: { nodes: Array<{
    oid: string
    message: string
    author: { name: string; email: string }
  }> }
  files: { nodes: Array<{
    path: string
    additions: number
    deletions: number
    changeType: string
  }> }
}

export type IssueSummary = {
  number: number
  title: string
  body: string
  author: { login: string }
  state: string
  createdAt: string
  url: string
  labels: { nodes: Array<{ name: string; color: string }> }
  assignees: { nodes: Array<{ login: string }> }
  milestone: { title: string } | null
  comments: { totalCount: number; nodes: Array<{
    author: { login: string }
    body: string
    createdAt: string
  }> }
}

export type ReviewPayload = {
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
  body: string
  comments?: Array<{
    path: string
    position: number
    body: string
  }>
}

export type FileContent = {
  path: string
  content: string | null
  sha?: string
  isNew: boolean
}
