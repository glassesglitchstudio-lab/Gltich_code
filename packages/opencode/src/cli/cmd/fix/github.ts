import type { GitHubIssue, FileContent } from "./types"

const GITHUB_API = "https://api.github.com"

function getHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function parseIssueUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

export async function fetchIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues/${number}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch issue: ${res.status} ${res.statusText}`)
  const data = await res.json() as any
  return {
    number: data.number,
    title: data.title,
    body: data.body || "",
    labels: (data.labels || []).map((l: any) => l.name || l),
    author: data.user?.login || "unknown",
    state: data.state,
    url: data.html_url,
  }
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`Failed to get repo info: ${res.status}`)
  const data = await res.json() as any
  return data.default_branch
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<FileContent> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers: getHeaders(),
  })
  if (res.status === 404) {
    return { path, content: null, isNew: true }
  }
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  const data = await res.json() as any
  const content = data.content ? Buffer.from(data.content, "base64").toString("utf-8") : null
  return { path, content, sha: data.sha, isNew: false }
}

export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string,
): Promise<{ created: boolean; branch: string }> {
  const baseRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches/${baseBranch}`, {
    headers: getHeaders(),
  })
  if (!baseRes.ok) throw new Error(`Base branch ${baseBranch} not found`)
  const baseData = await baseRes.json() as any
  const sha = baseData.commit.sha

  const createRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  })

  if (createRes.status === 422) {
    return { created: false, branch: branchName }
  }
  if (!createRes.ok) throw new Error(`Failed to create branch: ${createRes.status}`)
  return { created: true, branch: branchName }
}

export async function createCommit(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: Array<{ path: string; content: string }>,
): Promise<string> {
  let lastSha = await getLatestCommitSha(owner, repo, branch)

  for (const file of files) {
    const existingFile = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`, {
      headers: getHeaders(),
    })

    const body: any = {
      message,
      content: Buffer.from(file.content).toString("base64"),
      branch,
    }

    if (existingFile.ok) {
      const existingData = await existingFile.json() as any
      body.sha = existingData.sha
    }

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${file.path}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errData = await res.json() as any
      throw new Error(`Failed to commit ${file.path}: ${errData.message || res.status}`)
    }

    const commitData = await res.json() as any
    lastSha = commitData.commit.sha
  }

  return lastSha
}

async function getLatestCommitSha(owner: string, repo: string, branch: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches/${branch}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to get branch ${branch}`)
  const data = await res.json() as any
  return data.commit.sha
}

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<{ url: string; number: number }> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ title, body, head, base }),
  })
  if (!res.ok) {
    const errData = await res.json() as any
    throw new Error(`Failed to create PR: ${errData.message || res.status}`)
  }
  const data = await res.json() as any
  return { url: data.html_url, number: data.number }
}

export async function postComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error(`Failed to post comment: ${res.status}`)
}
