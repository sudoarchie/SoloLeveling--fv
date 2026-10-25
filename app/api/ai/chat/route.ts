import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getLLMConfig, streamChatCompletion } from "@/lib/llm"
import { buildChatPrompt, type UserContext } from "@/lib/ai-prompt"
import { analyzeStudyPatterns } from "@/lib/study-pattern"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // ── 1. Authenticate user ────────────────────────────────
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  // ── 2. Pro check ────────────────────────────────────────
  const { data: progressRow } = await supabase
    .from("user_progress")
    .select("plan")
    .eq("user_id", user.id)
    .single()

  if (progressRow?.plan !== "pro") {
    return NextResponse.json(
      { error: "AI Mentor is a Pro feature", code: "PRO_REQUIRED" },
      { status: 403 },
    )
  }

  // ── 3. Validate LLM config ─────────────────────────────
  let llmConfig
  try {
    llmConfig = getLLMConfig()
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }

  // ── 4. Parse request body ──────────────────────────────
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { messages, activePomodoro, chatMemory, sessionId, sessionTitle } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 })
  }

  // ── 5. Fetch all user data in parallel ─────────────────
  const today = new Date().toISOString().split("T")[0]

  const [
    progressRes,
    reportsRes,
    attemptsRes,
    timedAttemptsRes,
    topicsRes,
    streakRes,
    insightRes,
    chatSessionsRes,
    pomodoroRes,
  ] = await Promise.all([
    supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("report_date", { ascending: false })
      .limit(30),
    supabase
      .from("user_mock_attempts")
      .select("*, user_mock_exams(name)")
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(50),
    supabase.rpc("list_mock_exam_attempts"),
    supabase.from("revision_topics").select("*").eq("user_id", user.id),
    supabase
      .from("streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("ai_daily_insights")
      .select("content")
      .eq("user_id", user.id)
      .eq("insight_date", today)
      .maybeSingle(),
    Promise.resolve(
      supabase
        .from("ai_chat_sessions")
        .select("id, title, messages, summary, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10),
    ).catch(() => ({ data: null })),
    Promise.resolve(
      supabase
        .from("pomodoro_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20),
    ).catch(() => ({ data: null })),
  ])

  const userAttempts = Array.isArray(attemptsRes.data)
    ? attemptsRes.data.map((attempt: any) => ({
        ...attempt,
        mock_exams: { name: attempt.user_mock_exams?.name ?? "Exam" },
      }))
    : []

  const timedAttempts = Array.isArray(timedAttemptsRes.data)
    ? timedAttemptsRes.data
        .filter((attempt: any) => attempt.status === "completed" && Number(attempt.total_marks) > 0)
        .map((attempt: any) => ({
          mock_exams: { name: attempt.title },
          marks_obtained: Number(attempt.score),
          total_marks: Number(attempt.total_marks),
          score_pct: (Number(attempt.score) / Number(attempt.total_marks)) * 100,
          attempted_at: attempt.completed_at ?? attempt.started_at,
        }))
    : []

  const allAttempts = [...userAttempts, ...timedAttempts]
    .sort((a: any, b: any) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime())
    .slice(0, 50)

  const ctx: UserContext = {
    progress: progressRes.data,
    reports: reportsRes.data ?? [],
    attempts: allAttempts,
    topics: topicsRes.data ?? [],
    streak: streakRes.data,
  }

  // ── 6. Assemble previous chat memory & Pomodoro focus context ───
  let pastSessions: any[] = []
  if (Array.isArray(chatMemory) && chatMemory.length > 0) {
    pastSessions = chatMemory
  } else if (chatSessionsRes?.data && Array.isArray(chatSessionsRes.data)) {
    pastSessions = chatSessionsRes.data
      .filter((s: any) => !sessionId || s.id !== sessionId)
      .slice(0, 5)
      .map((s: any) => {
        const msgs = Array.isArray(s.messages) ? s.messages : []
        const userMsg = msgs.find((m: any) => m.role === "user")
        const assistantMsg = msgs.find((m: any) => m.role === "assistant")
        return {
          sessionId: s.id,
          title: s.title,
          date: s.updated_at ? new Date(s.updated_at).toLocaleDateString() : "",
          summary: s.summary,
          keyExchanges: [
            ...(userMsg ? [{ role: "user", content: String(userMsg.content).slice(0, 250) }] : []),
            ...(assistantMsg
              ? [{ role: "assistant", content: String(assistantMsg.content).slice(0, 250) }]
              : []),
          ],
        }
      })
  }

  let pomodoroContext = activePomodoro || null
  const pastPomodoroSessions = pomodoroRes?.data && Array.isArray(pomodoroRes.data) ? pomodoroRes.data : []
  const studyPattern = analyzeStudyPatterns(pastPomodoroSessions, pomodoroContext)

  if (!pomodoroContext && pastPomodoroSessions.length > 0) {
    const recent = pastPomodoroSessions[0]
    pomodoroContext = {
      preset: recent.preset,
      durationMinutes: recent.duration_minutes,
      description: recent.description,
      status: recent.status || (recent.completed ? "completed" : "active"),
      startedAt: recent.started_at,
      pauseCount: recent.pause_count || 0,
      totalPausedSeconds: recent.total_paused_seconds || 0,
      completedTodayCount: pastPomodoroSessions.filter((p: any) => p.completed).length,
      studyPattern,
      recentSessions: pastPomodoroSessions.slice(0, 5).map((p: any) => ({
        description: p.description,
        durationMinutes: p.duration_minutes,
        completedAt: p.ended_at || p.started_at,
        startedAt: p.started_at,
        pauseCount: p.pause_count || 0,
        totalPausedSeconds: p.total_paused_seconds || 0,
      })),
    }
  } else if (pomodoroContext) {
    pomodoroContext = {
      ...pomodoroContext,
      studyPattern: pomodoroContext.studyPattern || studyPattern,
    }
  }

  // Optionally persist active session updates to ai_chat_sessions in background
  if (sessionId) {
    Promise.resolve(
      supabase.from("ai_chat_sessions").upsert({
        id: sessionId,
        user_id: user.id,
        title: sessionTitle || "Study Mentoring Session",
        messages,
        updated_at: new Date().toISOString(),
      }),
    ).catch(() => {})
  }

  // ── 7. Build prompt with today's insight, Pomodoro focus, and previous chat memory
  const fullMessages = buildChatPrompt(
    ctx,
    insightRes.data?.content ?? null,
    messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    })),
    pomodoroContext,
    pastSessions,
  )

  // ── 7. Stream LLM response back to client ──────────────
  try {
    const llmRes = await streamChatCompletion(llmConfig, fullMessages)

    return new Response(llmRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI service error: ${e.message}` },
      { status: 502 },
    )
  }
}
