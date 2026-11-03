import { supabaseManager } from "../client/supabase.js"
import {
  getRank,
  getNextRank,
  getRankProgressDetails,
  calculateWeeklyStudyStats,
  RANKS,
} from "./ranks.js"
import {
  calculateGateMarksPrediction,
  GATE_RANK_THRESHOLDS,
} from "./gate-predictor.js"
import { analyzeStudyPatterns, type StudyPatternAnalysis } from "./study-pattern.js"
import type {
  UserProgressRow,
  DailyReportRow,
  StreakRow,
  RevisionTopicRow,
  MockAttemptRow,
  GatePredictorResult,
} from "../types.js"

export class PerformanceService {
  /**
   * Fetch core user profile and hunter rank status
   */
  public async getUserProfile() {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    const { data: progress } = await client
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    const { data: reports } = await client
      .from("daily_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("report_date", { ascending: false })
      .limit(30)

    const exp = progress?.current_exp ?? 0
    const formattedReports = (reports || []).map((r: any) => ({
      date: r.report_date,
      practiceHours: Number(r.practice_hours || 0),
      lecturesCompleted: Number(r.lectures_completed || 0),
    }))

    const weeklyStats = calculateWeeklyStudyStats(formattedReports)
    const rank = getRank(exp, weeklyStats.effectiveWeeklyHours)
    const nextRank = getNextRank(rank.name)
    const progressDetails = getRankProgressDetails(
      exp,
      weeklyStats.effectiveWeeklyHours,
      rank,
      nextRank,
    )

    let daysToExam: number | null = null
    if (progress?.exam_date) {
      try {
        const examD = new Date(progress.exam_date + "T00:00:00")
        if (!isNaN(examD.getTime())) {
          daysToExam = Math.max(0, Math.ceil((examD.getTime() - Date.now()) / 86_400_000))
        }
      } catch {}
    }

    return {
      userId: user.id,
      email: user.email,
      currentExp: exp,
      plan: progress?.plan || "free",
      hunterRank: {
        name: rank.name,
        title: rank.title,
        subtitle: rank.subtitle,
        color: rank.color,
        description: rank.description,
        quote: rank.quote,
        minWeeklyHours: rank.minWeeklyHours,
        gateMarksBand: `${rank.gateMarksMin} - ${rank.gateMarksMax} Marks`,
        predictedAir: rank.predictedAir,
        collegeProspects: rank.collegeProspects,
      },
      nextRank: nextRank
        ? {
            name: nextRank.name,
            title: nextRank.title,
            minExp: nextRank.minExp,
            minWeeklyHours: nextRank.minWeeklyHours,
            expNeeded: progressDetails.expNeeded,
            hoursNeeded: progressDetails.hoursNeeded,
            progressPercent: progressDetails.overallProgress,
            isTimeGated: progressDetails.isTimeGated,
            isExpGated: progressDetails.isExpGated,
          }
        : null,
      examDate: progress?.exam_date || null,
      daysRemainingToExam: daysToExam,
      weeklyStudyHours: {
        rolling7Days: weeklyStats.rolling7DaysHours,
        calendarWeek: weeklyStats.calendarWeekHours,
        dailyAverage: weeklyStats.dailyAvgHours,
        effectiveHours: weeklyStats.effectiveWeeklyHours,
      },
      customInstructions: progress?.custom_prompt || null,
      customization: {
        activeTitle: progress?.active_title || null,
        unlockedTitles: progress?.unlocked_titles || [],
        theme: progress?.selected_theme || "blue",
        unlockedCosmetics: progress?.unlocked_cosmetics || [],
      },
    }
  }

  /**
   * High-level executive overview for LLMs / ChatGPT
   */
  public async getPerformanceOverview() {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    const [
      progressRes,
      reportsRes,
      topicsRes,
      attemptsRes,
      streakRes,
      questsRes,
      insightRes,
    ] = await Promise.all([
      client.from("user_progress").select("*").eq("user_id", user.id).maybeSingle(),
      client
        .from("daily_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("report_date", { ascending: false })
        .limit(30),
      client.from("revision_topics").select("*").eq("user_id", user.id),
      client
        .from("user_mock_attempts")
        .select("*, user_mock_exams(name)")
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false })
        .limit(20),
      client.from("streaks").select("*").eq("user_id", user.id).maybeSingle(),
      client
        .from("daily_quests")
        .select("*")
        .eq("user_id", user.id)
        .eq("quest_date", new Date().toISOString().split("T")[0])
        .maybeSingle(),
      client
        .from("ai_daily_insights")
        .select("*")
        .eq("user_id", user.id)
        .order("insight_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const progress = progressRes.data
    const reports: DailyReportRow[] = reportsRes.data || []
    const topics: RevisionTopicRow[] = topicsRes.data || []
    const attempts = attemptsRes.data || []
    const streak: StreakRow | null = streakRes.data

    const exp = progress?.current_exp ?? 0
    const formattedReports = reports.map((r) => ({
      date: r.report_date,
      practiceHours: Number(r.practice_hours || 0),
      lecturesCompleted: Number(r.lectures_completed || 0),
    }))
    const weeklyStats = calculateWeeklyStudyStats(formattedReports)
    const rank = getRank(exp, weeklyStats.effectiveWeeklyHours)

    // Calculate dynamic streak from daily reports
    let dynamicStreak = 0
    const todayStr = new Date().toISOString().split("T")[0]
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0]
    if (reports.length > 0) {
      const latest = reports[0].report_date
      if (latest === todayStr || latest === yesterdayStr) {
        let expected = new Date(latest + "T00:00:00")
        for (const r of reports) {
          const rDate = new Date(r.report_date + "T00:00:00")
          const diffDays = Math.round((expected.getTime() - rDate.getTime()) / 86400000)
          if (diffDays === 0) {
            const hasActivity =
              Number(r.practice_hours || 0) > 0 ||
              Number(r.lectures_completed || 0) > 0 ||
              Number(r.topics_revised || 0) > 0 ||
              Number(r.exp_gained || 0) > 0
            if (hasActivity) {
              dynamicStreak++
              expected = new Date(rDate.getTime() - 86400000)
            } else break
          } else break
        }
      }
    }

    const effectiveStreak = Math.max(streak?.current_streak ?? 0, dynamicStreak)
    const longestStreak = Math.max(streak?.longest_streak ?? 0, effectiveStreak)

    // Spaced repetition topic breakdown
    const overdueTopics = topics.filter(
      (t) => !t.mastered && t.next_review_date < todayStr,
    )
    const dueTodayTopics = topics.filter(
      (t) => !t.mastered && t.next_review_date === todayStr,
    )
    const masteredTopics = topics.filter((t) => t.mastered)
    const onScheduleTopics = topics.filter(
      (t) => !t.mastered && t.next_review_date > todayStr,
    )

    // Mathematical Derivative Prediction
    const prediction: GatePredictorResult = calculateGateMarksPrediction({
      dailyReports: reports,
      mockAttempts: attempts,
      currentExp: exp,
      weeklyStudyStats: weeklyStats,
      examDate: progress?.exam_date,
      currentRank: rank,
    })

    // Mock summary stats
    const totalMocks = attempts.length
    const avgMockScore =
      totalMocks > 0
        ? Number(
            (
              attempts.reduce((acc, a) => acc + Number(a.score_pct || 0), 0) /
              totalMocks
            ).toFixed(1),
          )
        : null

    const totalPracticeHours = Number(
      reports.reduce((acc, r) => acc + Number(r.practice_hours || 0), 0).toFixed(1),
    )
    const totalLectures = reports.reduce((acc, r) => acc + Number(r.lectures_completed || 0), 0)

    return {
      hunterRank: `${rank.name}-Rank: ${rank.title}`,
      currentExp: exp,
      predictedGateScore: {
        score: prediction.currentMarks,
        range: prediction.predictedRange,
        airRange: prediction.currentThreshold.airRange,
        percentile: prediction.currentThreshold.percentile,
        admissionsOutlook: prediction.currentThreshold.targetOutlook,
        velocity: `${prediction.velocity > 0 ? "+" : ""}${prediction.velocity} marks/week`,
        momentum: prediction.momentumLabel,
        acceleration: `${prediction.acceleration > 0 ? "+" : ""}${prediction.acceleration} marks/week²`,
        projectedExamMarks: prediction.projectedExamMarks,
        projectedExamRank: `${prediction.projectedRank.name}-Rank: ${prediction.projectedRank.title}`,
        daysToSSS: prediction.daysToSSS,
        plateauWarning: prediction.plateauRisk,
      },
      consistencyAndStreak: {
        activeStreakDays: effectiveStreak,
        longestStreakDays: longestStreak,
        streakFreezesAvailable: streak?.streak_freezes ?? 0,
        totalTrackedDays: reports.length,
      },
      weeklyWorkload: {
        effectiveWeeklyHours: weeklyStats.effectiveWeeklyHours,
        dailyAverageHours: weeklyStats.dailyAvgHours,
        activeDaysLast7Days: weeklyStats.activeDays7,
        totalFocusHoursRecorded: totalPracticeHours,
        totalLecturesCompleted: totalLectures,
      },
      spacedRepetitionWeakTopics: {
        totalTracked: topics.length,
        dueToday: dueTodayTopics.length,
        overdue: overdueTopics.length,
        onSchedule: onScheduleTopics.length,
        mastered: masteredTopics.length,
        overdueTopicNames: overdueTopics.map((t) => t.name).slice(0, 5),
      },
      mockExams: {
        attemptsCount: totalMocks,
        averageScorePct: avgMockScore,
        recentAttempts: attempts.slice(0, 3).map((a: any) => ({
          exam: a.user_mock_exams?.name || "Mock Exam",
          scorePct: a.score_pct,
          marks: `${a.marks_obtained}/${a.total_marks}`,
          date: a.attempted_at,
        })),
      },
      dailyQuests: questsRes.data
        ? {
            allCompleted: questsRes.data.all_completed,
            questCount: Array.isArray(questsRes.data.quests) ? questsRes.data.quests.length : 0,
          }
        : null,
      latestAiInsight: insightRes.data
        ? {
            date: insightRes.data.insight_date,
            summary: insightRes.data.summary,
          }
        : null,
      examCountdown: {
        targetDate: progress?.exam_date || null,
        daysRemaining: prediction.daysToExam,
      },
      coachActionAdvice: prediction.currentThreshold.actionAdvice,
    }
  }

  /**
   * Detailed GATE prediction and derivative kinematics
   */
  public async getGateMarksPrediction() {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    const [progressRes, reportsRes, attemptsRes] = await Promise.all([
      client.from("user_progress").select("*").eq("user_id", user.id).maybeSingle(),
      client.from("daily_reports").select("*").eq("user_id", user.id).order("report_date", { ascending: false }),
      client.from("user_mock_attempts").select("*").eq("user_id", user.id),
    ])

    const progress = progressRes.data
    const reports = reportsRes.data || []
    const attempts = attemptsRes.data || []

    const formattedReports = reports.map((r: any) => ({
      date: r.report_date,
      practiceHours: Number(r.practice_hours || 0),
      lecturesCompleted: Number(r.lectures_completed || 0),
    }))
    const weeklyStats = calculateWeeklyStudyStats(formattedReports)
    const rank = getRank(progress?.current_exp || 0, weeklyStats.effectiveWeeklyHours)

    return calculateGateMarksPrediction({
      dailyReports: reports,
      mockAttempts: attempts,
      currentExp: progress?.current_exp || 0,
      weeklyStudyStats: weeklyStats,
      examDate: progress?.exam_date,
      currentRank: rank,
    })
  }

  /**
   * Streak analysis and consistency data
   */
  public async getStudyStreak() {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    const [streakRes, reportsRes] = await Promise.all([
      client.from("streaks").select("*").eq("user_id", user.id).maybeSingle(),
      client.from("daily_reports").select("*").eq("user_id", user.id).order("report_date", { ascending: false }).limit(30),
    ])

    const streak = streakRes.data
    const reports = reportsRes.data || []

    const todayStr = new Date().toISOString().split("T")[0]
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0]
    let dynamicStreak = 0

    if (reports.length > 0) {
      const latest = reports[0].report_date
      if (latest === todayStr || latest === yesterdayStr) {
        let expected = new Date(latest + "T00:00:00")
        for (const r of reports) {
          const rDate = new Date(r.report_date + "T00:00:00")
          const diffDays = Math.round((expected.getTime() - rDate.getTime()) / 86400000)
          if (diffDays === 0) {
            const hasActivity =
              Number(r.practice_hours || 0) > 0 ||
              Number(r.lectures_completed || 0) > 0 ||
              Number(r.topics_revised || 0) > 0 ||
              Number(r.exp_gained || 0) > 0
            if (hasActivity) {
              dynamicStreak++
              expected = new Date(rDate.getTime() - 86400000)
            } else break
          } else break
        }
      }
    }

    const effectiveStreak = Math.max(streak?.current_streak ?? 0, dynamicStreak)
    const longestStreak = Math.max(streak?.longest_streak ?? 0, effectiveStreak)
    const activeDaysCount = reports.filter(
      (r: any) =>
        Number(r.practice_hours || 0) > 0 ||
        Number(r.lectures_completed || 0) > 0 ||
        Number(r.topics_revised || 0) > 0 ||
        Number(r.exp_gained || 0) > 0,
    ).length

    const isLoggedToday = reports.some((r: any) => r.report_date === todayStr)

    return {
      currentStreak: effectiveStreak,
      longestStreak,
      dynamicStreakCalculated: dynamicStreak,
      streakFromDatabase: streak?.current_streak ?? 0,
      streakFreezesAvailable: streak?.streak_freezes ?? 0,
      totalActiveStudyDays: activeDaysCount,
      totalEntriesTracked: reports.length,
      lastQuestDate: streak?.last_quest_date || null,
      isLoggedToday,
    }
  }

  /**
   * Daily reports telemetry and trends
   */
  public async getDailyReports(days: number = 14, startDate?: string, endDate?: string) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    let query = client
      .from("daily_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("report_date", { ascending: false })

    if (startDate) {
      query = query.gte("report_date", startDate)
    }
    if (endDate) {
      query = query.lte("report_date", endDate)
    }
    if (!startDate && !endDate) {
      query = query.limit(Math.min(90, Math.max(1, days)))
    }

    const { data: reports, error } = await query
    if (error) throw new Error(`Failed to fetch daily reports: ${error.message}`)

    const list: DailyReportRow[] = reports || []
    const count = Math.max(1, list.length)

    const totalHours = list.reduce((s, r) => s + Number(r.practice_hours || 0), 0)
    const totalLectures = list.reduce((s, r) => s + Number(r.lectures_completed || 0), 0)
    const totalTopics = list.reduce((s, r) => s + Number(r.topics_revised || 0), 0)
    const totalExp = list.reduce((s, r) => s + Number(r.exp_gained || 0), 0)
    const morningSessions = list.filter((r) => r.morning_session).length
    const exerciseSessions = list.filter((r) => r.exercise_done).length
    const highDistractions = list.filter((r) => r.distractions_level === "High").length

    return {
      totalDays: list.length,
      aggregates: {
        avgPracticeHoursPerDay: Number((totalHours / count).toFixed(1)),
        totalPracticeHours: Number(totalHours.toFixed(1)),
        avgLecturesPerDay: Number((totalLectures / count).toFixed(1)),
        totalLectures,
        avgTopicsRevisedPerDay: Number((totalTopics / count).toFixed(1)),
        totalTopicsRevised: totalTopics,
        avgExpPerDay: Math.round(totalExp / count),
        totalExpGained: totalExp,
        morningSessionPercentage: Math.round((morningSessions / count) * 100),
        exercisePercentage: Math.round((exerciseSessions / count) * 100),
        highDistractionDaysCount: highDistractions,
      },
      reports: list,
    }
  }

  /**
   * Spaced repetition / weak topics
   */
  public async getRevisionTopics(
    status: "all" | "overdue" | "due_today" | "on_schedule" | "mastered" | "unreviewed" = "all",
    difficulty: "all" | "easy" | "medium" | "hard" = "all",
    subject?: string,
  ) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    let query = client
      .from("revision_topics")
      .select("*")
      .eq("user_id", user.id)
      .order("next_review_date", { ascending: true })

    if (subject) {
      query = query.ilike("subject", `%${subject}%`)
    }
    if (difficulty !== "all") {
      query = query.eq("difficulty", difficulty)
    }

    const { data: topics, error } = await query
    if (error) throw new Error(`Failed to fetch revision topics: ${error.message}`)

    const allTopics: RevisionTopicRow[] = topics || []
    const todayStr = new Date().toISOString().split("T")[0]

    const categorized = allTopics.map((t) => {
      let topicStatus: "overdue" | "due_today" | "on_schedule" | "mastered" | "unreviewed" =
        "on_schedule"
      let statusLabel = "On Schedule"

      if (t.mastered) {
        topicStatus = "mastered"
        statusLabel = "Mastered (4/4 Reviews Complete)"
      } else if (t.next_review_date < todayStr) {
        topicStatus = "overdue"
        statusLabel = `Overdue (was due on ${t.next_review_date})`
      } else if (t.next_review_date === todayStr) {
        topicStatus = "due_today"
        statusLabel = "Due Today"
      } else if (t.stage === 0 && (t.review_count || 0) === 0) {
        topicStatus = "unreviewed"
        statusLabel = "Stage 0 (Awaiting First Review)"
      } else {
        topicStatus = "on_schedule"
        statusLabel = `On Schedule (Stage ${t.stage}/4, due ${t.next_review_date})`
      }

      return {
        ...t,
        status: topicStatus,
        statusLabel,
      }
    })

    const filtered =
      status === "all"
        ? categorized
        : categorized.filter((t) => t.status === status)

    return {
      summary: {
        total: allTopics.length,
        dueToday: categorized.filter((t) => t.status === "due_today").length,
        overdue: categorized.filter((t) => t.status === "overdue").length,
        onSchedule: categorized.filter((t) => t.status === "on_schedule").length,
        mastered: categorized.filter((t) => t.status === "mastered").length,
        unreviewed: categorized.filter((t) => t.status === "unreviewed").length,
      },
      topics: filtered,
    }
  }

  /**
   * Mock test attempts
   */
  public async getMockTestHistory(
    limit: number = 20,
    examType?: "full_paper" | "subject_wise" | "topic_test",
    platform?: string,
  ) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    let query = client
      .from("user_mock_attempts")
      .select("*, user_mock_exams(name, exam_type, platform, total_marks)")
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)))

    const { data: attempts, error } = await query
    if (error) {
      if (error.code === "PGRST205") return { totalAttempts: 0, attempts: [] }
      throw new Error(`Failed to fetch mock test history: ${error.message}`)
    }

    let list = (attempts || []).map((a: any) => ({
      id: a.id,
      examId: a.exam_id,
      examName: a.user_mock_exams?.name || "Mock Exam",
      examType: a.user_mock_exams?.exam_type || "full_paper",
      platform: a.user_mock_exams?.platform || null,
      marksObtained: Number(a.marks_obtained),
      totalMarks: Number(a.total_marks),
      scorePercentage: Number(a.score_pct),
      accuracyPercentage: a.accuracy_pct !== null ? Number(a.accuracy_pct) : null,
      timeSpentMinutes: a.time_spent_minutes || null,
      totalQuestions: a.total_questions || null,
      questionsAttempted: a.questions_attempted || null,
      questionsCorrect: a.questions_correct || null,
      questionsIncorrect: a.questions_incorrect || null,
      expGained: a.exp_gained || 0,
      notes: a.notes || null,
      attemptedAt: a.attempted_at,
    }))

    if (examType) {
      list = list.filter((a) => a.examType === examType)
    }
    if (platform) {
      list = list.filter((a) => a.platform && a.platform.toLowerCase().includes(platform.toLowerCase()))
    }

    const total = list.length
    const avgScore =
      total > 0
        ? Number((list.reduce((acc, a) => acc + a.scorePercentage, 0) / total).toFixed(1))
        : null
    const highestScore =
      total > 0
        ? Math.max(...list.map((a) => a.scorePercentage))
        : null

    return {
      totalAttempts: total,
      analytics: {
        averageScorePercentage: avgScore,
        highestScorePercentage: highestScore,
      },
      attempts: list,
    }
  }

  /**
   * Pomodoro focus sessions and study patterns
   */
  public async getPomodoroFocusSessions(limit: number = 20, status?: string) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    let query = client
      .from("pomodoro_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(Math.min(50, Math.max(1, limit)))

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data: sessions, error } = await query
    if (error) {
      return {
        totalSessions: 0,
        patternAnalysis: analyzeStudyPatterns([]),
        sessions: [],
      }
    }

    const list = sessions || []
    const analysis: StudyPatternAnalysis = analyzeStudyPatterns(list)

    return {
      totalSessions: list.length,
      patternAnalysis: analysis,
      sessions: list.map((s: any) => ({
        id: s.id,
        preset: s.preset,
        durationMinutes: s.duration_minutes,
        description: s.description,
        status: s.status,
        completed: s.completed,
        expAwarded: s.exp_awarded,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        pauseCount: s.pause_count || 0,
        totalPausedSeconds: s.total_paused_seconds || 0,
        lastPauseReason: s.last_pause_description || null,
      })),
    }
  }

  /**
   * Daily quests
   */
  public async getDailyQuests(date?: string) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()
    const targetDate = date || new Date().toISOString().split("T")[0]

    const { data, error } = await client
      .from("daily_quests")
      .select("*")
      .eq("user_id", user.id)
      .eq("quest_date", targetDate)
      .maybeSingle()

    if (error && error.code !== "PGRST205") {
      throw new Error(`Failed to fetch daily quests: ${error.message}`)
    }

    return {
      date: targetDate,
      found: !!data,
      allCompleted: data?.all_completed ?? false,
      quests: Array.isArray(data?.quests) ? data.quests : [],
      updatedAt: data?.updated_at || null,
    }
  }

  /**
   * AI daily insights
   */
  public async getAiInsights(date?: string) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    let query = client
      .from("ai_daily_insights")
      .select("*")
      .eq("user_id", user.id)

    if (date) {
      query = query.eq("insight_date", date)
    } else {
      query = query.order("insight_date", { ascending: false }).limit(1)
    }

    const { data, error } = await query.maybeSingle()
    if (error && error.code !== "PGRST205") {
      throw new Error(`Failed to fetch AI insights: ${error.message}`)
    }

    return {
      found: !!data,
      insightDate: data?.insight_date || null,
      content: data?.content || null,
      summary: data?.summary || null,
      modelUsed: data?.model || null,
      generatedAt: data?.generated_at || null,
    }
  }

  /**
   * AI chat history sessions
   */
  public async getChatHistory(limit: number = 5) {
    const user = await supabaseManager.ensureAuthenticated()
    const client = supabaseManager.getClient()

    const { data, error } = await client
      .from("ai_chat_sessions")
      .select("id, title, summary, messages, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(Math.min(20, Math.max(1, limit)))

    if (error) {
      return { totalSessions: 0, sessions: [] }
    }

    return {
      totalSessions: data?.length || 0,
      sessions: (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        lastUpdated: s.updated_at,
        messagesCount: Array.isArray(s.messages) ? s.messages.length : 0,
      })),
    }
  }
}

export const performanceService = new PerformanceService()
