import type { GitHubIssue, FileContent } from "./types"
import { getGitHubClient, withRetry } from "../github/client"

export function parseIssueUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

export async function fetchIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
  const { octoRest } = getGitHubClient()
  const { data } = await withRetry(() =>
    octoRest.rest.issues.get({ owner, repo, issue_number: number }),
  )
  return {
    number: data.number,
    title: data.title,
    body: data.body || "",
    labels: (data.labels || []).map((l: any) => (typeof l === "string" ? l : l.name || "")),
    author: data.user?.login || "unknown",
    state: data.state as "open" | "closed",
    url: data.html_url,
  }
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const { octoRest } = getGitHubClient()
  const { data } = await withRetry(() =>
    octoRest.rest.repos.get({ owner, repo }),
  )
  return data.default_branch
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<FileContent> {
  const { octoRest } = getGitHubClient()
  try {
    const { data } = await withRetry(() =>
      octoRest.rest.repos.getContent({ owner, repo, path, ref: branch }),
    )
    if (Array.isArray(data) || data.type !== "file") {
      return { path, content: null, isNew: true }
    }
    const content = data.content
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : null
    return { path, content, sha: data.sha, isNew: false }
  } catch (error: any) {
    if (error.status === 404) {
      return { path, content: null, isNew: true }
    }
    throw error
  }
}

export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string,
): Promise<{ created: boolean; branch: string }> {
  const { octoRest } = getGitHubClient()

  const { data: baseData } = await withRetry(() =>
    octoRest.rest.repos.getBranch({ owner, repo, branch: baseBranch }),
  )
  const sha = baseData.commit.sha

  try {
    await withRetry(() =>
      octoRest.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    )
    return { created: true, branch: branchName }
  } catch (error: any) {
    if (error.status === 422) {
      return { created: false, branch: branchName }
    }
    throw error
  }
}

export async function createCommit(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: Array<{ path: string; content: string }>,
): Promise<string> {
  const { octoRest } = getGitHubClient()
  let lastSha = await getLatestCommitSha(owner, repo, branch)

  for (const file of files) {
    let sha: string | undefined
    try {
      const { data } = await withRetry(() =>
        octoRest.rest.repos.getContent({ owner, repo, path: file.path, ref: branch }),
      )
      if (!Array.isArray(data) && data.type === "file") {
        sha = data.sha
      }
    } catch {
      // Dosya yeni, sha yok
    }

    const { data } = await withRetry(() =>
      octoRest.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message,
        content: Buffer.from(file.content).toString("base64"),
        branch,
        sha: sha || undefined,
      }),
    )
    lastSha = data.commit.sha as string
  }

  return lastSha
}

async function getLatestCommitSha(owner: string, repo: string, branch: string): Promise<string> {
  const { octoRest } = getGitHubClient()
  const { data } = await withRetry(() =>
    octoRest.rest.repos.getBranch({ owner, repo, branch }),
  )
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
  const { octoRest } = getGitHubClient()
  const { data } = await withRetry(() =>
    octoRest.rest.pulls.create({ owner, repo, title, body, head, base }),
  )
  return { url: data.html_url, number: data.number }
}

export async function postComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const { octoRest } = getGitHubClient()
  await withRetry(() =>
    octoRest.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body }),
  )
}
