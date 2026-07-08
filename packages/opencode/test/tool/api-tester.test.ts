import { describe, expect, test, mock, afterEach, beforeEach } from "bun:test"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { ApiTesterTool } from "../../src/tool/api-tester"
import { SessionID, MessageID } from "../../src/session/schema"
import { Instance } from "../../src/project/instance"

const projectRoot = path.join(import.meta.dir, "../..")

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("message"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

async function exec(args: { url: string; method: "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT"; headers?: string; body?: string; timeout: number }) {
  return Instance.provide({
    directory: projectRoot,
    fn: () =>
      ApiTesterTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute(args, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      ),
  })
}

describe("api-tester", () => {
  const originalFetch = globalThis.fetch
  let mockFetch: ReturnType<typeof mock>

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
        }),
      ),
    )
    globalThis.fetch = mockFetch as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("successful GET request returns 200 response", async () => {
    const result = await exec({ url: "https://api.example.com/users", method: "GET" as const, timeout: 10000 })
    expect(result.title).toContain("200")
    expect(result.title).toContain("GET")
    expect(result.output).toContain("API Response")
    expect(result.output).toContain("200 OK")
    expect(result.metadata.status).toBe(200)
    expect(result.metadata.method).toBe("GET")
  })

  test("POST request with JSON body sets Content-Type header", async () => {
    const body = JSON.stringify({ name: "test" })
    const result = await exec({
      url: "https://api.example.com/users",
      method: "POST",
      body,
      timeout: 10000,
    })
    expect(result.metadata.method).toBe("POST")
    const callArgs = mockFetch.mock.calls[0]
    const init = callArgs[1] as RequestInit
    expect(init.method).toBe("POST")
  })

  test("custom headers are merged with defaults", async () => {
    await exec({
      url: "https://api.example.com/test",
      method: "GET" as const,
      headers: "X-Custom: value1\nAuthorization: Bearer token123",
      timeout: 10000,
    })
    const callArgs = mockFetch.mock.calls[0]
    const init = callArgs[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers["X-Custom"]).toBe("value1")
    expect(headers["Authorization"]).toBe("Bearer token123")
    expect(headers["User-Agent"]).toContain("GlitchCode")
  })

  test("handles fetch failure gracefully", async () => {
    // Mock fetch to never resolve, relying on the timeout to trigger AbortError
    globalThis.fetch = mock(() => new Promise(() => {})) as any
    const result = await exec({ url: "https://api.example.com/fail", method: "GET" as const, timeout: 1 })
    expect(result.output).toContain("API Request Failed")
    expect(result.metadata.error).toBe(true)
  })

  test("default method is GET", async () => {
    await exec({ url: "https://api.example.com/test", method: "GET" as const, timeout: 10000 })
    const callArgs = mockFetch.mock.calls[0]
    const init = callArgs[1] as RequestInit
    expect(init.method).toBe("GET")
  })

  test("non-JSON body uses text/plain Content-Type", async () => {
    await exec({
      url: "https://api.example.com/data",
      method: "POST",
      body: "plain text body",
      timeout: 10000,
    })
    const callArgs = mockFetch.mock.calls[0]
    const init = callArgs[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers["Content-Type"]).toBe("text/plain")
  })

  test("HEAD method does not send body", async () => {
    await exec({
      url: "https://api.example.com/check",
      method: "HEAD",
      body: "should not be sent",
      timeout: 10000,
    })
    const callArgs = mockFetch.mock.calls[0]
    const init = callArgs[1] as RequestInit
    expect(init.method).toBe("HEAD")
    expect(init.body).toBeUndefined()
  })

  test("large response body is truncated", async () => {
    const largeBody = "x".repeat(5000)
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(largeBody, {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "text/plain" },
        }),
      ),
    ) as any
    const result = await exec({ url: "https://api.example.com/large", method: "GET" as const, timeout: 10000 })
    expect(result.output).toContain("truncated")
  })
})
