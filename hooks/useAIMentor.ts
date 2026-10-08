"use client"

import { useState, useCallback, useRef } from "react"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export function useAIMentor() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      const userMessage: ChatMessage = { role: "user", content: content.trim() }
      const updatedMessages = [...messages, userMessage]

      setMessages(updatedMessages)
      setIsStreaming(true)
      setError(null)

      // Prepare abort controller for cancellation
      abortRef.current = new AbortController()

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        })

        // Handle non-streaming error responses
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          if (errBody.code === "PRO_REQUIRED") {
            setError("PRO_REQUIRED")
          } else {
            setError(errBody.error || `Error ${res.status}`)
          }
          // Remove the user message that failed
          setMessages(messages)
          return
        }

        // Parse SSE stream
        const reader = res.body?.getReader()
        if (!reader) {
          throw new Error("No response stream available")
        }

        const decoder = new TextDecoder()
        let assistantContent = ""

        // Add empty assistant message that we'll fill incrementally
        setMessages((prev) => [...prev, { role: "assistant", content: "" }])

        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split("\n")
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith("data: ")) continue
            const data = trimmed.slice(6)
            if (data === "[DONE]") continue

            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content ?? ""
              if (delta) {
                assistantContent += delta
                const snapshot = assistantContent
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: snapshot,
                  }
                  return updated
                })
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError("Could not reach the AI mentor. Please try again.")
        // Rollback to pre-send state
        setMessages(messages)
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [messages, isStreaming],
  )

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setError(null)
    setIsStreaming(false)
  }, [])

  const stopStreaming = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, error, sendMessage, clearChat, stopStreaming }
}
