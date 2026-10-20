"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  summary?: string
}

const STORAGE_KEY_SESSIONS = "gate_tracker_ai_sessions_v2"
const STORAGE_KEY_ACTIVE_ID = "gate_tracker_active_session_id_v2"

function generateSessionTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\s+/g, " ").trim()
  if (cleaned.length <= 40) return cleaned
  return cleaned.slice(0, 37) + "…"
}

function createEmptySession(): ChatSession {
  const id = crypto.randomUUID ? crypto.randomUUID() : `session_${Date.now()}`
  const now = new Date().toISOString()
  return {
    id,
    title: "New Conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function useAIMentor() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const initialized = useRef(false)

  // Derived current session & messages
  const currentSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === currentSessionId) ??
      sessions[0] ??
      createEmptySession()
    )
  }, [sessions, currentSessionId])

  const messages = currentSession.messages

  // Load saved sessions from localStorage and Supabase on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let localSessions: ChatSession[] = []
    let activeId = ""

    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS)
      if (raw) {
        localSessions = JSON.parse(raw)
      }
      activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || ""
    } catch {
      // Ignore
    }

    if (!localSessions || localSessions.length === 0) {
      const fresh = createEmptySession()
      localSessions = [fresh]
      activeId = fresh.id
    }

    if (!activeId || !localSessions.some((s) => s.id === activeId)) {
      activeId = localSessions[0].id
    }

    setSessions(localSessions)
    setCurrentSessionId(activeId)

    // Sync with Supabase if authenticated
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from("ai_chat_sessions")
        .select("id, title, messages, summary, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20)
        .then(({ data, error: supaErr }) => {
          if (!supaErr && data && Array.isArray(data) && data.length > 0) {
            setSessions((prev) => {
              const map = new Map<string, ChatSession>()
              // Add local first
              prev.forEach((s) => map.set(s.id, s))
              // Merge remote
              data.forEach((row: any) => {
                const existing = map.get(row.id)
                const remoteUpdated = new Date(row.updated_at).getTime()
                const localUpdated = existing ? new Date(existing.updatedAt).getTime() : 0
                if (!existing || remoteUpdated >= localUpdated) {
                  map.set(row.id, {
                    id: row.id,
                    title: row.title,
                    messages: Array.isArray(row.messages) ? row.messages : [],
                    createdAt: row.created_at || row.updated_at,
                    updatedAt: row.updated_at,
                    summary: row.summary,
                  })
                }
              })
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              )
              try {
                localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(merged))
              } catch {}
              return merged
            })
          }
        })
        .catch(() => {})
    })
  }, [])

  // Helper to persist sessions state locally and remotely
  const persistSessions = useCallback(
    (newSessions: ChatSession[], newActiveId?: string) => {
      setSessions(newSessions)
      if (newActiveId) {
        setCurrentSessionId(newActiveId)
      }
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(newSessions))
        if (newActiveId) {
          localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newActiveId)
        }
      } catch {
        // Storage limit or disabled
      }
    },
    [],
  )

  // Asynchronously save session to Supabase
  const syncSessionToSupabase = useCallback(async (session: ChatSession) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from("ai_chat_sessions").upsert({
        id: session.id,
        user_id: user.id,
        title: session.title,
        messages: session.messages,
        summary: session.summary ?? null,
        updated_at: session.updatedAt,
      })
    } catch {
      // Graceful fallback if table is not yet migrated
    }
  }, [])

  // Switch to a new conversation (fresh session that still retains memory of past chats!)
  const createNewChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setIsStreaming(false)
    setError(null)

    // If current session is already empty, just keep it
    if (currentSession.messages.length === 0) {
      return
    }

    const fresh = createEmptySession()
    const updated = [fresh, ...sessions]
    persistSessions(updated, fresh.id)
    toast.info("Started new conversation", {
      description: "Previous chat memory remains active in AI context.",
    })
  }, [currentSession, sessions, persistSessions])

  // Select an existing conversation from history
  const selectSession = useCallback(
    (sessionId: string) => {
      if (abortRef.current) abortRef.current.abort()
      setIsStreaming(false)
      setError(null)
      setCurrentSessionId(sessionId)
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, sessionId)
      } catch {}
    },
    [],
  )

  // Delete a conversation from history
  const deleteSession = useCallback(
    (sessionId: string) => {
      const remaining = sessions.filter((s) => s.id !== sessionId)
      let nextActive = currentSessionId
      if (sessionId === currentSessionId) {
        if (remaining.length > 0) {
          nextActive = remaining[0].id
        } else {
          const fresh = createEmptySession()
          remaining.push(fresh)
          nextActive = fresh.id
        }
      }
      persistSessions(remaining, nextActive)

      // Remove from Supabase
      try {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase
              .from("ai_chat_sessions")
              .delete()
              .eq("id", sessionId)
              .eq("user_id", user.id)
              .then(() => {})
          }
        })
      } catch {}

      toast.success("Conversation deleted")
    },
    [sessions, currentSessionId, persistSessions],
  )

  // Rename a conversation
  const renameSession = useCallback(
    (sessionId: string, newTitle: string) => {
      if (!newTitle.trim()) return
      const updated = sessions.map((s) =>
        s.id === sessionId ? { ...s, title: newTitle.trim(), updatedAt: new Date().toISOString() } : s,
      )
      persistSessions(updated)
      const target = updated.find((s) => s.id === sessionId)
      if (target) void syncSessionToSupabase(target)
    },
    [sessions, persistSessions, syncSessionToSupabase],
  )

  // Send message with streaming, Pomodoro context, and cross-chat memory
  const sendMessage = useCallback(
    async (content: string, activePomodoro?: any) => {
      if (!content.trim() || isStreaming) return

      const now = new Date().toISOString()
      const userMessage: ChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: now,
      }

      // Title determination
      const isFirstMessage = currentSession.messages.length === 0
      const sessionTitle = isFirstMessage
        ? generateSessionTitle(content)
        : currentSession.title

      const updatedMessages = [...currentSession.messages, userMessage]
      const updatedSession: ChatSession = {
        ...currentSession,
        title: sessionTitle,
        messages: updatedMessages,
        updatedAt: now,
      }

      const updatedSessions = sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s,
      )

      persistSessions(updatedSessions, currentSession.id)
      setIsStreaming(true)
      setError(null)

      // Prepare cross-chat memory from previous sessions
      const otherSessions = sessions.filter((s) => s.id !== currentSession.id)
      const chatMemory = otherSessions
        .filter((s) => s.messages && s.messages.length > 0)
        .slice(0, 5)
        .map((s) => {
          const userMsgs = s.messages.filter((m) => m.role === "user")
          const asstMsgs = s.messages.filter((m) => m.role === "assistant")
          return {
            sessionId: s.id,
            title: s.title,
            date: new Date(s.updatedAt).toLocaleDateString(),
            summary: s.summary,
            keyExchanges: [
              ...(userMsgs.length > 0
                ? [{ role: "user", content: userMsgs[0].content.slice(0, 250) }]
                : []),
              ...(asstMsgs.length > 0
                ? [{ role: "assistant", content: asstMsgs[asstMsgs.length - 1].content.slice(0, 250) }]
                : []),
            ],
          }
        })

      abortRef.current = new AbortController()

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSession.id,
            sessionTitle,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            activePomodoro: activePomodoro ?? null,
            chatMemory: chatMemory.length > 0 ? chatMemory : null,
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          if (errBody.code === "PRO_REQUIRED") {
            setError("PRO_REQUIRED")
          } else {
            setError(errBody.error || `Error ${res.status}`)
          }
          // Rollback user message on failure
          const rolledBackSession = {
            ...currentSession,
            messages: currentSession.messages,
          }
          persistSessions(
            sessions.map((s) =>
              s.id === currentSession.id ? rolledBackSession : s,
            ),
          )
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          throw new Error("No response stream available")
        }

        const decoder = new TextDecoder()
        let assistantContent = ""

        // Add empty assistant response to stream into
        const withAssistant = [
          ...updatedMessages,
          { role: "assistant" as const, content: "", timestamp: new Date().toISOString() },
        ]

        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSession.id ? { ...s, messages: withAssistant } : s,
          ),
        )

        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
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
                const currentAssistantText = assistantContent
                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id !== currentSession.id) return s
                    const copy = [...s.messages]
                    copy[copy.length - 1] = {
                      role: "assistant",
                      content: currentAssistantText,
                      timestamp: now,
                    }
                    return { ...s, messages: copy }
                  }),
                )
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }

        // Final save to localStorage & Supabase after stream completes
        const finalMessages = [
          ...updatedMessages,
          { role: "assistant" as const, content: assistantContent, timestamp: new Date().toISOString() },
        ]
        const finalSession: ChatSession = {
          ...updatedSession,
          messages: finalMessages,
          updatedAt: new Date().toISOString(),
        }

        persistSessions(
          sessions.map((s) =>
            s.id === currentSession.id ? finalSession : s,
          ),
        )
        void syncSessionToSupabase(finalSession)
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError("Could not reach the AI mentor. Please try again.")
        // Rollback
        persistSessions(
          sessions.map((s) =>
            s.id === currentSession.id ? currentSession : s,
          ),
        )
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [currentSession, sessions, isStreaming, persistSessions, syncSessionToSupabase],
  )

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const cleared: ChatSession = {
      ...currentSession,
      messages: [],
      updatedAt: new Date().toISOString(),
    }
    persistSessions(
      sessions.map((s) => (s.id === currentSession.id ? cleared : s)),
    )
    setError(null)
    setIsStreaming(false)
  }, [currentSession, sessions, persistSessions])

  const stopStreaming = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setIsStreaming(false)
  }, [])

  // Count past conversations for UI indicator
  const pastConversationsCount = sessions.filter(
    (s) => s.id !== currentSession.id && s.messages.length > 0,
  ).length

  return {
    sessions,
    currentSession,
    currentSessionId,
    messages,
    isStreaming,
    error,
    pastConversationsCount,
    sendMessage,
    createNewChat,
    selectSession,
    deleteSession,
    renameSession,
    clearChat,
    stopStreaming,
  }
}
