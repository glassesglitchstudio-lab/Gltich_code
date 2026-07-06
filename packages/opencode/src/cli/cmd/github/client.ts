import { Octokit } from "@octokit/rest"
import { graphql } from "@octokit/graphql"
import { parseGitHubRemote } from "../github"

export type GitHubClient = {
  octoRest: Octokit
  octoGraph: typeof graphql
}

let _client: GitHubClient | null = null

export function createGitHubClient(options?: {
  token?: string
}): GitHubClient {
  const token = options?.token || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error(
      "GitHub token bulunamadi. 'glitch auth login' calistirin veya GITHUB_TOKEN ortam degiskenini ayarlayin.",
    )
  }

  const octoRest = new Octokit({ auth: token })
  const octoGraph = graphql.defaults({
    headers: { authorization: `token ${token}` },
  })

  return { octoRest, octoGraph }
}

export function getGitHubClient(): GitHubClient {
  if (!_client) {
    _client = createGitHubClient()
  }
  return _client
}

export async function resolveRepo(): Promise<{ owner: string; repo: string }> {
  const { exec } = await import("child_process")
  const { promisify } = await import("util")
  const execAsync = promisify(exec)

  const { stdout } = await execAsync("git remote get-url origin", {
    cwd: process.cwd(),
  })

  const remote = stdout.trim()
  const parsed = parseGitHubRemote(remote)
  if (!parsed) {
    throw new Error(
      "GitHub repo bulunamadi. 'git remote -v' ile kontrol edin.",
    )
  }

  return parsed
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (i === retries) throw error

      if (error.status === 403 || error.status === 429) {
        const resetTime = error.response?.headers?.["x-ratelimit-reset"]
        const waitMs = resetTime
          ? Math.max(0, parseInt(resetTime) * 1000 - Date.now())
          : delayMs * (i + 1)
        console.log(`Rate limit. ${Math.ceil(waitMs / 1000)} saniye bekleniyor...`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }

      if (error.status >= 500) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
        continue
      }

      throw error
    }
  }
  throw new Error("Retry limit asildi")
}
