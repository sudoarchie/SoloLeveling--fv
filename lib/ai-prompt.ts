import type { ChatMessage } from "./llm"

export interface UserContext {
  progress: any
  reports: any[]
  attempts: any[]
  topics: any[]
  streak: any
}

import {
  RANKS,
  getRank as getHunterRank,
  getNextRank,
  calculateWeeklyStudyStats,
} from "@/lib/ranks"

// ── Base context (shared by briefing + chat) ───────────────

function buildBaseContext(ctx: UserContext): string {
  const { progress, reports, attempts, topics, streak } = ctx
  const exp = progress?.current_exp ?? 0

  // Format reports for calculateWeeklyStudyStats
  const formattedReports = (reports || []).map((r) => ({
    date: r.report_date,
    practiceHours: Number(r.practice_hours || 0),
    lecturesCompleted: Number(r.lectures_completed || 0),
  }))
  const weeklyStudyStats = calculateWeeklyStudyStats(formattedReports)

  const rank = getHunterRank(exp, weeklyStudyStats.effectiveWeeklyHours)
  const nextRank = getNextRank(rank.name)

  const daysToExam = progress?.exam_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(progress.exam_date + "T00:00:00").getTime() - Date.now()) /
            86_400_000,
        ),
      )
    : null

  const n = Math.max(reports.length, 1)
  const avgExp = reports.reduce((s: number, r: any) => s + (r.exp_gained ?? 0), 0) / n
  const avgLectures =
    reports.reduce((s: number, r: any) => s + (r.lectures_completed ?? 0), 0) / n
  const avgTopics =
    reports.reduce((s: number, r: any) => s + (r.topics_revised ?? 0), 0) / n
  const avgPractice =
    reports.reduce((s: number, r: any) => s + Number(r.practice_hours ?? 0), 0) / n
  const morningCount = reports.filter((r: any) => r.morning_session).length
  const exerciseCount = reports.filter((r: any) => r.exercise_done).length
  const highDistractionCount = reports.filter(
    (r: any) => r.distractions_level === "High",
  ).length

  // Mental state distribution
  const mentalStates: Record<string, number> = {}
  reports.forEach((r: any) => {
    const state = r.mental_state || "not recorded"
    mentalStates[state] = (mentalStates[state] || 0) + 1
  })

  // Mock test summary
  const mockSummary =
    attempts.length > 0
      ? attempts
          .slice(0, 15)
          .map(
            (a: any) =>
              `${a.mock_exams?.name ?? "Exam"}: ${Number(a.score_pct ?? 0).toFixed(1)}% (${a.marks_obtained}/${a.total_marks}) on ${new Date(a.attempted_at).toLocaleDateString()}`,
          )
          .join("\n  ")
      : "No mock tests taken yet."

  // Revision topics
  const now = new Date()
  const dueTopics = topics.filter(
    (t: any) => !t.mastered && new Date(t.next_review_date) <= now,
  )
  const masteredTopics = topics.filter((t: any) => t.mastered)
  const stuckTopics = topics.filter(
    (t: any) => t.stage === 0 && !t.mastered,
  )

  // Recent daily logs
  const recentLogs = reports
    .slice(0, 7)
    .map(
      (r: any) =>
        `  ${r.report_date}: ${r.lectures_completed} lectures, ${r.topics_revised} topics, ${r.practice_hours}h practice, EXP=${r.exp_gained}, distraction=${r.distractions_level}, mental="${r.mental_state || "—"}"`,
    )
    .join("\n")

  // Week-over-week trend
  const thisWeek = reports.slice(0, 7)
  const lastWeek = reports.slice(7, 14)
  const thisWeekExp = thisWeek.reduce((s: number, r: any) => s + (r.exp_gained ?? 0), 0)
  const lastWeekExp = lastWeek.reduce((s: number, r: any) => s + (r.exp_gained ?? 0), 0)
  const weekTrend =
    lastWeekExp > 0
      ? `${thisWeekExp > lastWeekExp ? "↑" : "↓"} ${Math.abs(Math.round(((thisWeekExp - lastWeekExp) / lastWeekExp) * 100))}% vs last week`
      : "Not enough data for week-over-week comparison"

  return `You are an elite GATE exam preparation mentor, cognitive scientist, and high-performance coach embedded in the student's tracker.
You evaluate the student through the lens of cognitive psychology and behavioral neuroscience, backed by their real preparation telemetry.

═══ STUDENT PROFILE ═══
• Total EXP: ${exp} (${rank.name}-Rank: "${rank.title}" · Weekly Study: ${weeklyStudyStats.effectiveWeeklyHours.toFixed(1)} hrs/wk)
${nextRank ? `• Next rank: ${nextRank.name}-Rank (Requires ${nextRank.minExp} EXP & ${nextRank.minWeeklyHours} hrs/wk avg study time)` : "• Highest rank achieved!"}
• Exam Date: ${progress?.exam_date ?? "Not set"}${daysToExam !== null ? ` (${daysToExam} days remaining)` : ""}
• Study Streak: ${streak?.current_streak ?? 0} days (longest: ${streak?.longest_streak ?? 0})
• Total Days Completed: ${streak?.days_completed ?? 0}
• Streak Freezes Available: ${streak?.streak_freezes ?? 0}

═══ LAST ${reports.length} DAYS — TELEMETRY ═══
• Avg EXP/day: ${avgExp.toFixed(0)}
• Avg lectures/day: ${avgLectures.toFixed(1)}
• Avg topics revised/day: ${avgTopics.toFixed(1)}
• Avg practice hours/day: ${avgPractice.toFixed(1)}
• Morning sessions: ${morningCount}/${reports.length} days (${((morningCount / n) * 100).toFixed(0)}%)
• Exercise done: ${exerciseCount}/${reports.length} days (${((exerciseCount / n) * 100).toFixed(0)}%)
• High distraction days: ${highDistractionCount}/${reports.length}
• Mental state distribution: ${JSON.stringify(mentalStates)}
• Week trend: ${weekTrend}

═══ RECENT 7-DAY LOG ═══
${recentLogs || "  No logs yet."}

═══ MOCK TEST HISTORY (${attempts.length} attempts) ═══
  ${mockSummary}
${attempts.length > 0 ? `• Average mock score: ${(attempts.reduce((s: number, a: any) => s + Number(a.score_pct ?? 0), 0) / attempts.length).toFixed(1)}%` : ""}

═══ REVISION TOPICS (${topics.length} tracked) ═══
• Due for review NOW: ${dueTopics.length}
• Mastered: ${masteredTopics.length}
• Stuck at stage 0 (never reviewed): ${stuckTopics.length}
${topics.length > 0 ? "• All topics:\n  " + topics.map((t: any) => `${t.name} [stage ${t.stage}/4, ${t.difficulty}, ${t.mastered ? "✓mastered" : `next: ${t.next_review_date}`}]`).join("\n  ") : "• No topics tracked yet."}

═══ MENTOR BEHAVIOR & METHODOLOGY ═══
1. COGNITIVE PSYCHOLOGY & NEUROSCIENCE FOUNDATION:
   - Base your recommendations on proven cognitive mechanisms:
     • Spaced Retrieval & Forgetting Curve (Ebbinghaus): Delaying review until slight retrieval difficulty strengthens LTP (Long-Term Potentiation).
     • Active Recall vs. Fluency Illusion: Warn them when watching lectures without solving problems creates false mastery ("recognition is not recall").
     • Interleaving & Desirable Difficulty: Urge them to alternate problem types rather than block-practicing one formula.
     • Prefrontal Fatigue & Dopamine Management: Address distractions, sleep, and morning mental clarity scientifically.

2. SCOLD & CALL OUT COMPLACENCY (TOUGH LOVE):
   - You are NOT a sycophantic cheerleader. You are an uncompromising coach who wants them to crack GATE with a top rank.
   - If practice hours are 0 or negligible while lecture hours are high: Scold them bluntly. Watching lectures without solving numericals is passive entertainment, not preparation.
   - If overdue revision topics are sitting ignored: Confront them on memory decay.
   - If they break a streak or log repeated high distractions: Demand accountability. Do not coddle excuses or self-pity.
   - Be firm, direct, and intellectually demanding — but always couple criticism with the exact physiological/behavioral fix.

3. ASK DIAGNOSTIC & PROBING QUESTIONS:
   - When the student's query is vague or their data reveals a red flag, do not just lecture — cross-examine them:
     • "Why did your question practice drop to zero over the last three days?"
     • "When you solve previous year questions, are you attempting them timed and closed-book, or are you checking solutions after 3 minutes?"
     • "You logged 'High' distraction twice this week — what specific trigger hijacked your focus?"
   - End with 1 sharp, direct question that forces them to confront their current habit or decision.

4. REALISTIC EXAM URGENCY:
   - Factor in days remaining (${daysToExam ?? "unknown"}). Every day that passes reduces syllabus coverage runway. Adjust advice dynamically from foundational building to test-taking endurance and error-reduction.

5. CONCISE, STRUCTURED DELIVERY & MARKDOWN FORMATTING:
   - Write cleanly with bullet points, bold emphasis, and markdown tables when comparing figures.
   - TABLE FORMAT RULE: When creating a markdown table, you MUST always include the standard header separator line (e.g. | --- | --- |) and surround all rows with leading and trailing pipes (| col 1 | col 2 |).
   - Keep advice razor-sharp and under 450 words.${
     progress?.custom_prompt?.trim()
       ? `\n\n═══ USER'S PERSONAL CUSTOM MEMORY & INSTRUCTIONS ═══
The student has set the following personal instructions/memory for you. Prioritize and honor these personal rules across all responses:
"""
${progress.custom_prompt.trim()}
"""`
       : ""
   }`
}

// ── Daily Briefing prompt (for midnight cron) ──────────────

export function buildDailyBriefingPrompt(ctx: UserContext): ChatMessage[] {
  return [
    { role: "system", content: buildBaseContext(ctx) },
    {
      role: "user",
      content: `Generate my daily study briefing for today.

Structure your response exactly like this:

## 📊 Performance Snapshot
Brief stats summary with key numbers.

## 💪 What's Going Well
2-3 specific strengths backed by data.

## ⚠️ Areas Needing Attention
2-3 specific weaknesses with evidence from the data.

## 🎯 Today's Recommended Focus
3-5 concrete action items for today, prioritized.

## 📈 Exam Readiness
Overall trajectory and honest assessment of where the student stands.

At the very end, output a JSON block (fenced with \`\`\`json) with this exact shape:
\`\`\`json
{
  "strengths": ["short strength 1", "short strength 2"],
  "weaknesses": ["short weakness 1", "short weakness 2"],
  "todayFocus": ["action 1", "action 2", "action 3"],
  "riskLevel": "low"
}
\`\`\`
riskLevel must be "low", "medium", or "high" based on overall exam readiness.`,
    },
  ]
}

// ── Chat prompt (for live conversation) ────────────────────

export interface PomodoroFocusContext {
  preset?: string
  durationMinutes?: number
  description?: string
  status?: string
  timeLeftSeconds?: number
  completedTodayCount?: number
  recentSessions?: Array<{
    description: string
    durationMinutes: number
    completedAt?: string
  }>
}

export interface ChatMemorySession {
  sessionId?: string
  title?: string
  date?: string
  summary?: string
  keyExchanges?: Array<{
    role: string
    content: string
  }>
}

export function buildChatPrompt(
  ctx: UserContext,
  todayInsight: string | null,
  userMessages: ChatMessage[],
  activePomodoro?: PomodoroFocusContext | null,
  chatMemory?: ChatMemorySession[] | null,
): ChatMessage[] {
  let system = buildBaseContext(ctx)

  if (todayInsight) {
    system += `\n\n═══ TODAY'S PRE-GENERATED BRIEFING ═══
The student already has this daily briefing. Reference it naturally but don't repeat it verbatim:
${todayInsight}`
  }

  // Inject active or recent Pomodoro session context so the AI has a clear idea of what the user is doing
  if (
    activePomodoro &&
    (activePomodoro.description?.trim() ||
      activePomodoro.status === "running" ||
      activePomodoro.status === "paused" ||
      (activePomodoro.completedTodayCount && activePomodoro.completedTodayCount > 0))
  ) {
    const minsLeft =
      typeof activePomodoro.timeLeftSeconds === "number"
        ? Math.floor(activePomodoro.timeLeftSeconds / 60)
        : null
    const secsLeft =
      typeof activePomodoro.timeLeftSeconds === "number"
        ? activePomodoro.timeLeftSeconds % 60
        : null

    system += `\n\n═══ CURRENT / RECENT POMODORO FOCUS SESSION ═══
• Current Status: ${(activePomodoro.status || "active").toUpperCase()}
• Focus Block Duration: ${activePomodoro.durationMinutes ?? 25} minutes (${activePomodoro.preset ?? "custom"})
• Focus Task & Description: "${activePomodoro.description?.trim() || "Deep study block"}"
${minsLeft !== null ? `• Time Remaining in Session: ${minsLeft}m ${secsLeft}s` : ""}
• Focus Blocks Completed Today: ${activePomodoro.completedTodayCount ?? 0}
${
  activePomodoro.recentSessions && activePomodoro.recentSessions.length > 0
    ? `• Other Focus Blocks Completed Today:\n${activePomodoro.recentSessions
        .map((s) => `  - "${s.description}" (${s.durationMinutes}m)`)
        .join("\n")}`
    : ""
}

POMODORO COACHING DIRECTIVE:
The student has explicitly entered this description for their focus session so you have a crystal-clear understanding of what they are doing at this exact time.
- Contextualize your advice, explanations, question suggestions, and problem-solving tactics directly to this task.
- Help them stay sharp, prevent passive illusions of competence, and diagnose specific hurdles in this focus topic.
- If they ask general questions, ground your answers in the topic of this active session whenever applicable.`
  }

  // Inject cross-chat memory so new chats can seamlessly reference previous chat conversations
  if (chatMemory && chatMemory.length > 0) {
    const memoryBlocks = chatMemory
      .filter((s) => s.title || (s.keyExchanges && s.keyExchanges.length > 0) || s.summary)
      .slice(0, 5)
      .map((session, idx) => {
        const title = session.title || `Past Chat ${idx + 1}`
        const dateStr = session.date ? ` (${session.date})` : ""
        const summary = session.summary ? `Summary: ${session.summary}\n` : ""
        const exchanges =
          session.keyExchanges && session.keyExchanges.length > 0
            ? session.keyExchanges
                .slice(-4)
                .map(
                  (ex) =>
                    `  - ${ex.role === "user" ? "Student asked/said" : "Mentor advised"}: "${ex.content.slice(0, 200)}${ex.content.length > 200 ? "…" : ""}"`,
                )
                .join("\n")
            : ""
        return `[Chat: "${title}"${dateStr}]\n${summary}${exchanges}`
      })
      .join("\n\n")

    if (memoryBlocks.trim()) {
      system += `\n\n═══ PREVIOUS CONVERSATIONS MEMORY (CROSS-CHAT CONTINUITY) ═══
You have continuous long-term memory across all past coaching sessions with this student.
Here is the memory digest of their recent previous chat sessions:

${memoryBlocks}

CROSS-SESSION MEMORY RULES:
1. You REMEMBER these previous conversations. When the student starts a new chat or asks follow-ups (e.g. "as we discussed before", "my weak areas from yesterday", "continue with the topic we discussed"), you have direct access to this context.
2. Maintain unbroken continuity of their preparation journey across multiple chat sessions.
3. Hold them accountable to commitments or advice given in earlier conversations without needing them to repeat their background.
4. Seamlessly incorporate this background knowledge into your responses.`
    }
  }

  return [{ role: "system", content: system }, ...userMessages]
}
