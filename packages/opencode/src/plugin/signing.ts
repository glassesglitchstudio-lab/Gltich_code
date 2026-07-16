import { generateKeyPairSync, sign, verify, createHash } from "crypto"
import { join } from "path"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import os from "os"
import { Filesystem } from "@/util"
import { Glob } from "@glitchcode/shared/util/glob"

const KEYS_DIR = join(os.homedir(), ".glitchcode", "keys")
const TRUST_FILE = join(os.homedir(), ".glitchcode", "trust.json")
const SIGNATURE_FILE = "plugin-signature.json"
const SIGNABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]

export type KeyPair = {
  publicKey: string
  privateKey: string
}

export type PluginSignature = {
  signature: string
  hash: string
  timestamp: number
  publicKey: string
}

export type VerificationResult = {
  valid: boolean
  error?: string
}

function getKeysDir(): string {
  return KEYS_DIR
}

function getTrustPath(): string {
  return TRUST_FILE
}

/**
 * Generate an Ed25519 key pair for plugin signing.
 * Stores keys in ~/.glitchcode/keys/ as public.pem and private.pem.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })

  const keysDir = getKeysDir()
  const publicKeyPath = join(keysDir, "public.pem")
  const privateKeyPath = join(keysDir, "private.pem")

  Filesystem.write(publicKeyPath, publicKey, 0o644)
  Filesystem.write(privateKeyPath, privateKey, 0o600)

  return { publicKey, privateKey }
}

/**
 * Hash the content of a plugin package for signing/verification.
 * Reads package.json and all signable source files, concatenates their
 * content in a deterministic order, and produces a SHA-256 digest.
 */
function hashPackageContent(packagePath: string): string {
  const hash = createHash("sha256")

  // Always include package.json first for determinism
  const pkgJsonPath = join(packagePath, "package.json")
  const pkgJson = Filesystem.readText(pkgJsonPath)
  hash.update(`---package.json---\n${pkgJson}\n`)

  // Find all signable source files
  const files: string[] = []
  for (const ext of SIGNABLE_EXTENSIONS) {
    const matches = Glob.scanSync(`**/*${ext}`, {
      cwd: packagePath,
      absolute: false,
      include: "file",
      dot: false,
    })
    for (const match of matches) {
      // Skip package.json (already included) and node_modules
      if (match === "package.json" || match.includes("node_modules") || match.includes(SIGNATURE_FILE)) {
        continue
      }
      files.push(match)
    }
  }

  files.sort()
  for (const file of files) {
    const content = Filesystem.readText(join(packagePath, file))
    hash.update(`---${file}---\n${content}\n`)
  }

  return hash.digest("hex")
}

/**
 * Sign a plugin package using a private key.
 * Creates a SHA-256 hash of the package content, signs it with the
 * Ed25519 private key, and saves the signature to plugin-signature.json.
 */
export function signPlugin(
  privateKey: string,
  packagePath: string,
): PluginSignature {
  const hash = hashPackageContent(packagePath)
  const signatureBuffer = sign(null, Buffer.from(hash, "hex"), privateKey)
  const signature = signatureBuffer.toString("base64")

  const publicKey = readPublicKeyFromPrivate(privateKey)

  const pluginSignature: PluginSignature = {
    signature,
    hash,
    timestamp: Date.now(),
    publicKey,
  }

  const signaturePath = join(packagePath, SIGNATURE_FILE)
  Filesystem.writeJson(signaturePath, pluginSignature)

  return pluginSignature
}

/**
 * Extract the public key from a PEM-encoded private key.
 */
function readPublicKeyFromPrivate(privateKeyPem: string): string {
  // Generate the public key from the private key using raw key extraction
  const result = generateKeyPairSync("ed25519", {
    privateKey: { key: privateKeyPem, format: "pem", type: "pkcs8" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  })
  return result.publicKey as unknown as string
}

/**
 * Verify a plugin's signature against a trusted public key.
 * Re-hashes the package content and compares with the stored signature.
 */
export function verifyPlugin(
  publicKey: string,
  packagePath: string,
): VerificationResult {
  const signaturePath = join(packagePath, SIGNATURE_FILE)

  if (!Filesystem.exists(signaturePath)) {
    return { valid: false, error: "No plugin-signature.json found in package" }
  }

  let stored: PluginSignature
  try {
    stored = JSON.parse(readFileSync(signaturePath, "utf-8")) as PluginSignature
  } catch {
    return { valid: false, error: "Failed to read plugin-signature.json" }
  }

  if (!stored.signature || !stored.hash || !stored.publicKey) {
    return { valid: false, error: "plugin-signature.json is missing required fields" }
  }

  // Use the public key from the signature file if provided key doesn't match
  const keyToUse = publicKey || stored.publicKey

  const currentHash = hashPackageContent(packagePath)
  if (currentHash !== stored.hash) {
    return { valid: false, error: "Package content has been modified since signing" }
  }

  const signatureBuffer = Buffer.from(stored.signature, "base64")
  const valid = verify(null, Buffer.from(currentHash, "hex"), keyToUse, signatureBuffer)

  if (!valid) {
    return { valid: false, error: "Signature verification failed" }
  }

  return { valid: true }
}

/**
 * Save a trust list of author public keys.
 * Format: { "author-name": "public-key-pem", ... }
 */
export function saveTrustList(trustedKeys: Record<string, string>): void {
  const dir = join(os.homedir(), ".glitchcode")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(getTrustPath(), JSON.stringify(trustedKeys, null, 2))
}

/**
 * Load the trust list of author public keys.
 * Returns an empty object if the file doesn't exist.
 */
export function loadTrustList(): Record<string, string> {
  if (!existsSync(getTrustPath())) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(getTrustPath(), "utf-8")) as Record<string, string>
  } catch {
    return {}
  }
}

/**
 * Check if an author is in the trust list.
 */
export function isTrusted(author: string): boolean {
  const trustList = loadTrustList()
  return author in trustList
}

/**
 * Get the public key for a trusted author, if they exist.
 */
export function getTrustedKey(author: string): string | undefined {
  const trustList = loadTrustList()
  return trustList[author]
}


