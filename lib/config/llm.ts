import type { LlmBody } from "./types.ts"

export interface ChatMessage {
  role: "system" | "user"
  content: string
}

/** Chat completion assembled from the catalog LLM record. The secret is not part of this object. */
export interface PreparedChat {
  url: string
  headerName: string
  apiKeyEnv: string
  body: {
    model: string
    temperature: number
    messages: ChatMessage[]
  }
}

export interface UnavailableChat {
  executed: false
  reason: "llm_unavailable_on_this_system"
  prepared: PreparedChat
}

/** Builds the LiteLLM chat completion. Does not send it. */
export function planChat(llm: LlmBody, messages: ChatMessage[]): PreparedChat {
  const base = llm.baseUrl.replace(/\/$/, "")
  return {
    url: `${base}/chat/completions`,
    headerName: llm.apiKeyHeader,
    apiKeyEnv: llm.apiKeyEnv,
    body: {
      model: llm.model,
      temperature: llm.temperature,
      messages,
    },
  }
}

/**
 * Sends a prepared completion. Document flows do not call this here:
 * the runtime has no API key and cannot reach the proxy.
 * A host that can execute passes the key from `prepared.apiKeyEnv`.
 */
export async function sendChat(prepared: PreparedChat, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(prepared.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [prepared.headerName]: apiKey,
    },
    body: JSON.stringify(prepared.body),
  })
  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`)
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return payload.choices?.[0]?.message?.content ?? ""
}

/** The document services use this. It records the request and does not call the network. */
export function planUnavailableChat(llm: LlmBody, messages: ChatMessage[]): UnavailableChat {
  return {
    executed: false,
    reason: "llm_unavailable_on_this_system",
    prepared: planChat(llm, messages),
  }
}
