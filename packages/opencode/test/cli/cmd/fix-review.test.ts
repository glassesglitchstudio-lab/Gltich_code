import { describe, expect, test } from "bun:test"
import { parseReviewResponse } from "../../../src/cli/cmd/fix"

describe("parseReviewResponse", () => {
  test("parses valid JSON with LGTM verdict", () => {
    const text = '```json\n{"verdict":"LGTM","score":85,"suggestions":["use const"]}\n```'
    const result = parseReviewResponse(text)
    expect(result.approved).toBe(true)
    expect(result.score).toBe(85)
    expect(result.suggestions).toEqual(["use const"])
  })

  test("parses valid JSON with Duzeltme Gerekli verdict", () => {
    const text = '```json\n{"verdict":"Duzeltme Gerekli","score":40,"suggestions":["fix injection"]}\n```'
    const result = parseReviewResponse(text)
    expect(result.approved).toBe(false)
    expect(result.score).toBe(40)
    expect(result.suggestions).toEqual(["fix injection"])
  })

  test("parses valid JSON with GUVENLI verdict", () => {
    const text = '```json\n{"verdict":"GUVENLI","score":95,"suggestions":[]}\n```'
    const result = parseReviewResponse(text)
    expect(result.approved).toBe(true)
    expect(result.score).toBe(95)
  })

  test("parses valid JSON with Risk Var verdict", () => {
    const text = '```json\n{"verdict":"Risk Var","score":30,"suggestions":["add CSRF protection"]}\n```'
    const result = parseReviewResponse(text)
    expect(result.approved).toBe(false)
    expect(result.score).toBe(30)
  })

  test("clamps score to 0-100 range", () => {
    const text = '```json\n{"verdict":"LGTM","score":150,"suggestions":[]}\n```'
    const result = parseReviewResponse(text)
    expect(result.score).toBe(100)
  })

  test("clamps negative score to 0", () => {
    const text = '```json\n{"verdict":"LGTM","score":-10,"suggestions":[]}\n```'
    const result = parseReviewResponse(text)
    expect(result.score).toBe(0)
  })

  test("handles missing score field", () => {
    const text = '```json\n{"verdict":"LGTM","suggestions":[]}\n```'
    const result = parseReviewResponse(text)
    expect(result.score).toBe(0)
  })

  test("handles missing suggestions field", () => {
    const text = '```json\n{"verdict":"LGTM","score":80}\n```'
    const result = parseReviewResponse(text)
    expect(result.suggestions).toEqual([])
  })

  test("handles non-array suggestions", () => {
    const text = '```json\n{"verdict":"LGTM","score":80,"suggestions":"fix this"}\n```'
    const result = parseReviewResponse(text)
    expect(result.suggestions).toEqual([])
  })

  test("falls back to regex on invalid JSON", () => {
    const result = parseReviewResponse("LGTM! Great code.")
    expect(result.approved).toBe(true)
    expect(result.score).toBe(0)
    expect(result.feedback).toBe("LGTM! Great code.")
  })

  test("falls back to regex on malformed JSON block", () => {
    const result = parseReviewResponse('```json\n{invalid json}\n```\n\nLGTM!')
    expect(result.approved).toBe(true)
    expect(result.score).toBe(0)
  })

  test("detects 'safe' as approved in fallback", () => {
    const result = parseReviewResponse("Code is safe. No issues found.")
    expect(result.approved).toBe(true)
  })

  test("detects 'no issues' as approved in fallback", () => {
    const result = parseReviewResponse("No issues found in the review.")
    expect(result.approved).toBe(true)
  })

  test("returns not approved for unclear verdict in fallback", () => {
    const result = parseReviewResponse("Some review text with no clear verdict.")
    expect(result.approved).toBe(false)
  })

  test("extracts suggestions from JSON array", () => {
    const text = '```json\n{"verdict":"LGTM","score":75,"suggestions":["add types","remove console.log","use async/await"]}\n```'
    const result = parseReviewResponse(text)
    expect(result.suggestions).toHaveLength(3)
  })

  test("preserves full text as feedback", () => {
    const text = 'Some analysis\n```json\n{"verdict":"LGTM","score":90,"suggestions":[]}\n```\nMore text'
    const result = parseReviewResponse(text)
    expect(result.feedback).toBe(text)
  })
})
