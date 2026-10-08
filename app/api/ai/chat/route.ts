import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getLLMConfig, streamChatCompletion } from "@/lib/llm"
import { buildChatPrompt, type UserContext } from "@/lib/ai-prompt"
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

  const { messages } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 })
  }

  // ── 5. Fetch all user data in parallel ─────────────────
  const today = new Date().toISOString().split("T")[0]

  const [progressRes, reportsRes, attemptsRes, topicsRes, streakRes, insightRes] =
    await Promise.all([
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
        .from("mock_test_attempts")
        .select("*, mock_exams(name)")
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false })
        .limit(50),
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
    ])

  const ctx: UserContext = {
    progress: progressRes.data,
    reports: reportsRes.data ?? [],
    attempts: attemptsRes.data ?? [],
    topics: topicsRes.data ?? [],
    streak: streakRes.data,
  }

  // ── 6. Build prompt with today's insight as extra context
  const fullMessages = buildChatPrompt(
    ctx,
    insightRes.data?.content ?? null,
    messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    })),
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
