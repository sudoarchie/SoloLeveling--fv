/**
 * Provider-agnostic LLM client.
 * Talks the standard OpenAI /v1/chat/completions protocol.
 * Works with: Ola Krutrim, BharatRouter, OpenRouter, Groq, Together, OpenAI, Ollama, etc.
 * Zero external npm dependencies — uses native fetch().
 */

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxOutputTokens: number
}

/** Read LLM config from environment. Throws if required vars are missing. */
export function getLLMConfig(): LLMConfig {
  const baseUrl = process.env.LLM_BASE_URL || "https://cloud.olakrutrim.com/v1"
  const apiKey = process.env.LLM_API_KEY || process.env.KRUTRIM_API_KEY
  const model = process.env.LLM_MODEL || "gpt-120b-oss"

  if (!apiKey) {
    throw new Error(
      "AI Mentor is not configured. Set LLM_API_KEY in .env.local",
    )
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: apiKey.trim(),
    model: model.trim(),
    maxOutputTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 4096,
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Streaming chat completion — for real-time chat UI.
 * Returns the raw Response with an SSE stream body.
 */
export async function streamChatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
): Promise<Response> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxOutputTokens,
      stream: true,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `LLM API error ${res.status}: ${body.slice(0, 300) || res.statusText}`,
    )
  }

  return res
}

/**
 * Non-streaming chat completion — for cron batch processing.
 * Waits for the full response and returns the content string and usage stats.
 */
export async function chatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
): Promise<{ content: string; usage?: { total_tokens?: number } }> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxOutputTokens,
      stream: false,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `LLM API error ${res.status}: ${body.slice(0, 300) || res.statusText}`,
    )
  }

  const json = await res.json()
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    usage: json.usage,
  }
}
