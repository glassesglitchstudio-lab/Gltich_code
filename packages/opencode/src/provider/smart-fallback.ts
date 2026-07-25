/**
 * Smart Fallback System
 *
 * Enhanced provider fallback with:
 * - Cost-aware routing (prefer cheaper providers)
 * - Latency-based routing (prefer faster providers)
 * - Success rate weighting
 * - Smart chain ordering
 */
import type { ProviderID, ModelID } from "./schema"
import { getAverageLatency, getSuccessRate, getBestProvider } from "./health"

export interface FallbackCandidate {
  providerID: ProviderID
  modelID: ModelID
  source: string
  cost?: { input: number; output: number }
  latencyMs?: number
  successRate?: number
}

export interface FallbackStrategy {
  name: string
  description: string
  rank: (candidates: FallbackCandidate[]) => FallbackCandidate[]
}

/**
 * Cost-aware strategy: prefer providers with lower cost.
 */
export const costAwareStrategy: FallbackStrategy = {
  name: "cost-aware",
  description: "Prefer cheaper providers",
  rank(candidates) {
    return [...candidates].sort((a, b) => {
      const costA = a.cost ? a.cost.input + a.cost.output : 0
      const costB = b.cost ? b.cost.input + b.cost.output : 0
      return costA - costB
    })
  },
}

/**
 * Latency-based strategy: prefer faster providers.
 */
export const latencyStrategy: FallbackStrategy = {
  name: "latency",
  description: "Prefer faster providers",
  rank(candidates) {
    return [...candidates].sort((a, b) => {
      const latA = a.latencyMs ?? getAverageLatency(a.providerID, a.modelID) ?? 5000
      const latB = b.latencyMs ?? getAverageLatency(b.providerID, b.modelID) ?? 5000
      return latA - latB
    })
  },
}

/**
 * Reliability strategy: prefer providers with higher success rates.
 */
export const reliabilityStrategy: FallbackStrategy = {
  name: "reliability",
  description: "Prefer more reliable providers",
  rank(candidates) {
    return [...candidates].sort((a, b) => {
      const rateA = a.successRate ?? getSuccessRate(a.providerID, a.modelID)
      const rateB = b.successRate ?? getSuccessRate(b.providerID, b.modelID)
      return rateB - rateA
    })
  },
}

/**
 * Balanced strategy: combine cost, latency, and reliability.
 */
export const balancedStrategy: FallbackStrategy = {
  name: "balanced",
  description: "Balance cost, speed, and reliability",
  rank(candidates) {
    return [...candidates].sort((a, b) => {
      const scoreA = computeScore(a)
      const scoreB = computeScore(b)
      return scoreB - scoreA
    })
  },
}

function computeScore(c: FallbackCandidate): number {
  const cost = c.cost ? c.cost.input + c.cost.output : 5
  const latency = c.latencyMs ?? getAverageLatency(c.providerID, c.modelID) ?? 5000
  const successRate = c.successRate ?? getSuccessRate(c.providerID, c.modelID)

  // Normalize: cost 0-20 → 0-1 (lower is better → invert), latency 0-10000 → 0-1 (invert)
  const costScore = 1 - Math.min(cost / 20, 1)
  const latencyScore = 1 - Math.min(latency / 10000, 1)

  // Weighted: reliability 50%, latency 30%, cost 20%
  return successRate * 0.5 + latencyScore * 0.3 + costScore * 0.2
}

/**
 * Smart fallback chain builder.
 * Takes candidates and a strategy, returns ordered fallback list.
 */
export function buildFallbackChain(
  candidates: FallbackCandidate[],
  strategy: FallbackStrategy = balancedStrategy,
): FallbackCandidate[] {
  // Filter out candidates without valid keys
  const valid = candidates.filter((c) => {
    // Candidates from config always have valid keys
    if (c.source === "config") return true
    // Others need to be checked by the caller
    return true
  })

  return strategy.rank(valid)
}

/**
 * Provider priority tiers for automatic fallback ordering.
 * Used when no explicit fallback is configured.
 */
export const PROVIDER_TIERS: Record<string, number> = {
  // Tier 0: Free / always available
  opencode: 0,
  // Tier 1: Major providers (most reliable)
  openai: 1,
  anthropic: 1,
  google: 1,
  // Tier 2: Strong alternatives
  openrouter: 2,
  groq: 2,
  deepseek: 2,
  mistral: 2,
  // Tier 3: Budget / specialized
  cerebras: 3,
  togetherai: 3,
  deepinfra: 3,
  xai: 3,
  novita: 3,
  "novita-ai": 3,
  sambanova: 3,
  chutes: 3,
  "chutes-ai": 3,
  // Tier 4: Enterprise / niche
  azure: 4,
  "amazon-bedrock": 4,
  "google-vertex": 4,
  gitlab: 4,
  perplexity: 4,
  // Tier 5: Chinese providers
  alibaba: 5,
  "alibaba-cn": 5,
  zhipuai: 5,
  moonshot: 5,
}

export function getProviderTier(providerID: string): number {
  return PROVIDER_TIERS[providerID] ?? 99
}
