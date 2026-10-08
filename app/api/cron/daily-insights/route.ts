import { createClient } from "@supabase/supabase-js"
import { getLLMConfig, chatCompletion } from "@/lib/llm"
import { buildDailyBriefingPrompt, type UserContext } from "@/lib/ai-prompt"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  // ── 1. Verify request is from Vercel Cron or authorized scheduler ────
  const auth = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Service-role Supabase client (bypasses RLS) ───────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 },
    )
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── 3. Load LLM config ──────────────────────────────────
  let llmConfig
  try {
    llmConfig = getLLMConfig()
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }

  const today = new Date().toISOString().split("T")[0]

  // ── 4. Get pro users only ───────────────────────────────
  const { data: proUsers, error: usersError } = await supabase
    .from("user_progress")
    .select("user_id")
    .eq("plan", "pro")

  if (usersError || !proUsers) {
    return NextResponse.json(
      { error: "Failed to fetch users", detail: usersError?.message },
      { status: 500 },
    )
  }

  if (proUsers.length === 0) {
    return NextResponse.json({ message: "No pro users to process", processed: 0 })
  }

  // ── 5. Skip users who already have today's insight ──────
  const { data: existing } = await supabase
    .from("ai_daily_insights")
    .select("user_id")
    .eq("insight_date", today)

  const doneIds = new Set((existing ?? []).map((e: any) => e.user_id))
  const pending = proUsers.filter((u: any) => !doneIds.has(u.user_id))

  let processed = 0
  let failed = 0
  const errors: string[] = []

  // ── 6. Process each pro user sequentially ───────────────
  for (const { user_id } of pending) {
    try {
      // Fetch all data for this user
      const [progressRes, reportsRes, attemptsRes, topicsRes, streakRes] =
        await Promise.all([
          supabase
            .from("user_progress")
            .select("*")
            .eq("user_id", user_id)
            .single(),
          supabase
            .from("daily_reports")
            .select("*")
            .eq("user_id", user_id)
            .order("report_date", { ascending: false })
            .limit(30),
          supabase
            .from("mock_test_attempts")
            .select("*, mock_exams(name)")
            .eq("user_id", user_id)
            .order("attempted_at", { ascending: false })
            .limit(50),
          supabase
            .from("revision_topics")
            .select("*")
            .eq("user_id", user_id),
          supabase
            .from("streaks")
            .select("*")
            .eq("user_id", user_id)
            .maybeSingle(),
        ])

      const ctx: UserContext = {
        progress: progressRes.data,
        reports: reportsRes.data ?? [],
        attempts: attemptsRes.data ?? [],
        topics: topicsRes.data ?? [],
        streak: streakRes.data,
      }

      // Skip users with zero activity — no meaningful insight to generate
      if (ctx.reports.length === 0) continue

      // Call LLM (non-streaming)
      const messages = buildDailyBriefingPrompt(ctx)
      const result = await chatCompletion(llmConfig, messages)

      // Extract structured JSON summary from response
      let summary: Record<string, any> = {}
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          summary = JSON.parse(jsonMatch[1])
        } catch {
          // If JSON parsing fails, proceed with empty summary
        }
      }

      // Upsert into DB
      const { error: insertError } = await supabase
        .from("ai_daily_insights")
        .upsert(
          {
            user_id,
            insight_date: today,
            content: result.content,
            summary,
            model: llmConfig.model,
            tokens_used: result.usage?.total_tokens ?? null,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,insight_date" },
        )

      if (insertError) throw insertError
      processed++
    } catch (err: any) {
      failed++
      errors.push(`${user_id}: ${err.message?.slice(0, 100)}`)
      // Continue to next user — one failure shouldn't stop the batch
    }
  }

  return NextResponse.json({
    message: "Daily insights cron completed",
    processed,
    failed,
    skipped: doneIds.size,
    totalProUsers: proUsers.length,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
