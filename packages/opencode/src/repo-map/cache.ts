import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import type { FileEntry } from "./types"

const CACHE_DIR = ".repo-map-cache"
const CACHE_VERSION = 1

export class RepoMapCache {
  private cacheDir: string
  private memoryCache: Map<string, FileEntry> = new Map()

  constructor(root?: string) {
    this.cacheDir = path.join(root || process.cwd(), CACHE_DIR)
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch {
      // Ignore mkdir errors
    }
  }

  async get(filePath: string): Promise<FileEntry | null> {
    // Memory cache first
    const cached = this.memoryCache.get(filePath)
    if (cached) {
      return cached
    }

    // Disk cache
    const cacheKey = this.getCacheKey(filePath)
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`)

    try {
      const content = await fs.readFile(cachePath, "utf-8")
      const entry: FileEntry = JSON.parse(content)
      this.memoryCache.set(filePath, entry)
      return entry
    } catch {
      return null
    }
  }

  async set(entry: FileEntry): Promise<void> {
    // Memory cache
    this.memoryCache.set(entry.path, entry)

    // Disk cache
    const cacheKey = this.getCacheKey(entry.path)
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`)

    try {
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2))
    } catch {
      // Ignore write errors
    }
  }

  async has(filePath: string, hash: string): Promise<boolean> {
    const cached = await this.get(filePath)
    if (!cached) return false
    return cached.hash === hash
  }

  async invalidate(filePath: string): Promise<void> {
    this.memoryCache.delete(filePath)

    const cacheKey = this.getCacheKey(filePath)
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`)

    try {
      await fs.unlink(cachePath)
    } catch {
      // Ignore unlink errors
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear()

    try {
      const files = await fs.readdir(this.cacheDir)
      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(this.cacheDir, file))
        }
      }
    } catch {
      // Ignore errors
    }
  }

  async getStats(): Promise<{
    totalFiles: number
    memorySize: number
    diskSize: number
  }> {
    let diskSize = 0
    let totalFiles = 0

    try {
      const files = await fs.readdir(this.cacheDir)
      for (const file of files) {
        if (file.endsWith(".json")) {
          totalFiles++
          const stat = await fs.stat(path.join(this.cacheDir, file))
          diskSize += stat.size
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      totalFiles,
      memorySize: this.memoryCache.size,
      diskSize,
    }
  }

  async getInvalidFiles(
    filePaths: string[],
    currentHashes: Map<string, string>,
  ): Promise<string[]> {
    const invalidFiles: string[] = []

    for (const filePath of filePaths) {
      const currentHash = currentHashes.get(filePath)
      if (!currentHash) {
        invalidFiles.push(filePath)
        continue
      }

      const cached = await this.get(filePath)
      if (!cached || cached.hash !== currentHash) {
        invalidFiles.push(filePath)
      }
    }

    return invalidFiles
  }

  private getCacheKey(filePath: string): string {
    const hash = crypto.createHash("md5").update(filePath).digest("hex")
    return `${CACHE_VERSION}-${hash}`
  }

  static async computeFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath)
      return crypto.createHash("md5").update(content).digest("hex")
    } catch {
      return ""
    }
  }
}

let _instance: RepoMapCache | null = null

export function getRepoMapCache(root?: string): RepoMapCache {
  if (!_instance || root) {
    _instance = new RepoMapCache(root)
  }
  return _instance
}
