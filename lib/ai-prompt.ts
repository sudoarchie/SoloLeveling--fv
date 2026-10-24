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
  const totalTopicsRevisedInReports = reports.reduce((s: number, r: any) => s + (r.topics_revised ?? 0), 0)
  const totalTopicReviewsInSR = topics.reduce((s: number, t: any) => s + (t.review_count ?? 0), 0)
  const effectiveTotalTopicsRevised = Math.max(totalTopicsRevisedInReports, totalTopicReviewsInSR)
  const avgTopics = effectiveTotalTopicsRevised / n
  const totalPracticeHours = reports.reduce((s: number, r: any) => s + Number(r.practice_hours ?? 0), 0)
  const avgPractice = totalPracticeHours / n
  const morningCount = reports.filter((r: any) => r.morning_session).length
  const exerciseCount = reports.filter((r: any) => r.exercise_done).length
  const highDistractionCount = reports.filter(
    (r: any) => r.distractions_level === "High",
  ).length

  // Calculate dynamic continuous active study streak directly from reports
  const sortedReports = [...(reports || [])].sort((a, b) => b.report_date.localeCompare(a.report_date))
  const todayStr = new Date().toISOString().split("T")[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0]

  let dynamicStudyStreak = 0
  if (sortedReports.length > 0) {
    const latestDate = sortedReports[0].report_date
    if (latestDate === todayStr || latestDate === yesterdayStr) {
      let expectedDate = new Date(latestDate + "T00:00:00")
      for (const r of sortedReports) {
        const rDate = new Date(r.report_date + "T00:00:00")
        const diffDays = Math.round((expectedDate.getTime() - rDate.getTime()) / 86400000)
        if (diffDays === 0) {
          const hasActivity =
            Number(r.practice_hours ?? 0) > 0 ||
            Number(r.lectures_completed ?? 0) > 0 ||
            Number(r.topics_revised ?? 0) > 0 ||
            Number(r.exp_gained ?? 0) > 0
          if (hasActivity) {
            dynamicStudyStreak++
            expectedDate = new Date(rDate.getTime() - 86400000)
          } else {
            break
          }
        } else {
          break
        }
      }
    }
  }

  const activeDaysTracked = reports.filter(
    (r: any) =>
      Number(r.practice_hours ?? 0) > 0 ||
      Number(r.lectures_completed ?? 0) > 0 ||
      Number(r.topics_revised ?? 0) > 0 ||
      Number(r.exp_gained ?? 0) > 0,
  ).length
  const effectiveStreak = Math.max(streak?.current_streak ?? 0, dynamicStudyStreak)
  const totalDaysCompleted = Math.max(streak?.days_completed ?? 0, activeDaysTracked)
  const earliestReportDate = sortedReports.length > 0 ? sortedReports[sortedReports.length - 1].report_date : null

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

  // Spaced repetition topic breakdown
  const todayDateStr = new Date().toISOString().split("T")[0]
  const dueTopics = topics.filter(
    (t: any) => !t.mastered && t.next_review_date <= todayDateStr,
  )
  const overdueTopics = topics.filter(
    (t: any) => !t.mastered && t.next_review_date < todayDateStr,
  )
  const dueTodayTopics = topics.filter(
    (t: any) => !t.mastered && t.next_review_date === todayDateStr,
  )
  const onScheduleTopics = topics.filter(
    (t: any) => !t.mastered && t.next_review_date > todayDateStr,
  )
  const masteredTopics = topics.filter((t: any) => t.mastered)
  const neverReviewedTopics = topics.filter(
    (t: any) => t.stage === 0 && (t.review_count ?? 0) === 0 && !t.mastered,
  )

  const topicsList = topics.length > 0
    ? topics
        .map((t: any) => {
          let statusText = ""
          if (t.mastered) {
            statusText = "✓ Mastered"
          } else if (t.next_review_date < todayDateStr) {
            statusText = `⚠️ OVERDUE (was due ${t.next_review_date})`
          } else if (t.next_review_date === todayDateStr) {
            statusText = "🔔 DUE TODAY for review"
          } else {
            statusText = `✓ On Schedule (passed Stage ${t.stage}/4, next review due on ${t.next_review_date})`
          }
          return `  - "${t.name}" [${statusText} | Difficulty: ${t.difficulty || "medium"} | Reviews logged: ${t.review_count ?? 0}]`
        })
        .join("\n")
    : "  No topics tracked yet."

  // Recent daily logs
  const recentLogs = reports
    .slice(0, 7)
    .map(
      (r: any) =>
        `  ${r.report_date}: ${r.lectures_completed} lectures, ${r.topics_revised} topics revised, ${r.practice_hours}h focus/practice, EXP=${r.exp_gained}, distraction=${r.distractions_level}, mental="${r.mental_state || "—"}"`,
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
• Exam Date: ${progress?.exam_date ?? "Not set"}${daysToExam !== null ? ` (${daysToExam} days remaining until exam)` : ""}
• Tracker Onboarding Timeline: Student has logged ${reports.length} days of study data (active study on ${totalDaysCompleted} days, tracked since ${earliestReportDate || "recently"}).
• Current Study Streak: ${effectiveStreak} days active streak (longest: ${Math.max(streak?.longest_streak ?? 0, effectiveStreak)} days)
• Streak Freezes Available: ${streak?.streak_freezes ?? 0}

═══ LAST ${reports.length} DAYS — TELEMETRY ═══
• Tracking Timeline: Active for ${reports.length} days (${totalDaysCompleted} study days logged)
• Avg EXP/day: ${avgExp.toFixed(0)}
• Avg lectures completed/day: ${avgLectures.toFixed(1)}
• Avg topics revised/day: ${avgTopics.toFixed(1)}
• Avg study/practice focus hours/day: ${avgPractice.toFixed(1)} (${totalPracticeHours.toFixed(1)} total focus hrs logged)
  (Note: Study hours include Pomodoro focus blocks, concept lecture comprehension, notes review, and numerical practice.)
• Morning sessions: ${morningCount}/${reports.length} days (${((morningCount / n) * 100).toFixed(0)}%)
• Exercise done: ${exerciseCount}/${reports.length} days (${((exerciseCount / n) * 100).toFixed(0)}%)
• High distraction days: ${highDistractionCount}/${reports.length}
• Mental state distribution: ${JSON.stringify(mentalStates)}
• Week trend: ${weekTrend}

═══ RECENT 7-DAY LOG ═══
${recentLogs || "  No logs yet."}

═══ MOCK TEST HISTORY (${attempts.length} attempts) ═══
  ${mockSummary}
${attempts.length > 0 ? `• Average mock score: ${(attempts.reduce((s: number, a: any) => s + Number(a.score_pct ?? 0), 0) / attempts.length).toFixed(1)}%` : `• Status: 0 mock tests taken so far. (Context: Student has only tracked ${reports.length} days of foundational study. ${daysToExam !== null ? `${daysToExam} days remaining until exam.` : ""})`}

═══ REVISION & SPACED REPETITION (${topics.length} topics tracked) ═══
• Total Spaced Reviews Completed: ${totalTopicReviewsInSR}
• On-Schedule Topics (passed previous review stage, awaiting future scheduled date): ${onScheduleTopics.length}
• Overdue for Review: ${overdueTopics.length}
• Due Today for Review: ${dueTodayTopics.length}
• Mastered Topics: ${masteredTopics.length}
• Unreviewed / Stage 0 Topics: ${neverReviewedTopics.length}
${topics.length > 0 ? "• Tracked Topics Breakdown:\n" + topicsList : "• No topics tracked yet."}

═══ MENTOR BEHAVIOR & METHODOLOGY ═══
1. COGNITIVE PSYCHOLOGY & NEUROSCIENCE FOUNDATION:
   - Base your recommendations on proven cognitive mechanisms:
     • Spaced Retrieval & Forgetting Curve (Ebbinghaus): Delaying review until slight retrieval difficulty strengthens LTP (Long-Term Potentiation).
     • Active Recall vs. Fluency Illusion: Warn them when watching lectures without solving problems creates false mastery ("recognition is not recall").
     • Interleaving & Desirable Difficulty: Urge them to alternate problem types rather than block-practicing one formula.
     • Prefrontal Fatigue & Dopamine Management: Address distractions, sleep, and morning mental clarity scientifically.

2. ACCURACY & DATA GROUNDING (CRITICAL):
   - DO NOT CONFUSE DAYS REMAINING WITH DAYS STUDIED: The student has only been tracking for ${reports.length} days (${totalDaysCompleted} active days). ${daysToExam !== null ? `There are ${daysToExam} days remaining until the exam date.` : ""} NEVER claim "0 mock tests in ${daysToExam} days" or accuse them of months of inaction when they only started tracking recently. Early preparation focuses on syllabus coverage before full-length mocks.
   - ACCURATE REVISION STATUS: Topics in the Spaced Repetition system at Stage 1 or higher with upcoming review dates are ON SCHEDULE, NOT "stuck" or "in debt". The student reviewed them to reach Stage 1. Only scold about revision if topics are actually overdue or if the student has never scheduled any revision topics.
   - STUDY & PRACTICE HOURS CONTEXT: Telemetry hours represent the student's total focused deep-work time (Pomodoro focus blocks, lecture study, note synthesis, and problem solving). When the student is progressing through subjects like Computer Networks, DBMS, or Algorithms, their focus hours reflect active syllabus acquisition. Do NOT invent false accusations of "mindless DSA block practice" when the student's logged topics and focus sessions indicate they are working through Computer Networks, DBMS, or theory notes.
   - HONEST TELEMETRY: The student has an active streak of ${effectiveStreak} days. Acknowledge and reinforce their real consistency rather than claiming 0 streak.

3. SCOLD & CALL OUT REAL COMPLACENCY (TOUGH LOVE):
   - You are NOT a sycophantic cheerleader. You are an uncompromising coach who wants them to crack GATE with a top rank.
   - If practice hours are 0 or negligible while lecture hours are high: Scold them bluntly. Watching lectures without solving numericals is passive entertainment, not preparation.
   - If overdue revision topics are sitting ignored: Confront them on memory decay.
   - If they break a streak or log repeated high distractions: Demand accountability. Do not coddle excuses or self-pity.
   - Be firm, direct, and intellectually demanding — but always couple criticism with the exact physiological/behavioral fix.

4. ASK DIAGNOSTIC & PROBING QUESTIONS:
   - When the student's query is vague or their data reveals a red flag, do not just lecture — cross-examine them:
     • "When you solve previous year questions, are you attempting them timed and closed-book, or are you checking solutions after 3 minutes?"
     • "You logged 'High' distraction on 2026-10-19 — what specific trigger hijacked your focus?"
   - End with 1 sharp, direct question that forces them to confront their current habit or decision.

5. REALISTIC EXAM URGENCY:
   - Factor in days remaining (${daysToExam ?? "unknown"}). Every day that passes reduces syllabus coverage runway. Adjust advice dynamically from foundational building to test-taking endurance and error-reduction.

6. CONCISE, STRUCTURED DELIVERY & MARKDOWN FORMATTING:
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
