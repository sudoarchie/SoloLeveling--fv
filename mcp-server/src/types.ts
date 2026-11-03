export type RankName = "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS"

export interface RankInfo {
  name: RankName
  title: string
  subtitle: string
  color: string
  minExp: number
  maxExp: number
  minWeeklyHours: number
  minDailyAvgHours: number
  gateMarksMin: number
  gateMarksMax: number
  predictedAir: string
  collegeProspects: string
  description: string
  quote: string
}

export interface WeeklyStudyStats {
  rolling7DaysHours: number
  calendarWeekHours: number
  dailyAvgHours: number
  effectiveWeeklyHours: number
  activeDays7: number
}

export interface GateRankThreshold {
  rank: RankName
  minMarks: number
  maxMarks: number
  airRange: string
  percentile: string
  targetOutlook: string
  actionAdvice: string
  color: string
}

export interface DerivativeDataPoint {
  date: string
  label: string
  fullDate: string
  actualMarks: number | null
  predictedMarks: number
  optimisticMarks: number | null
  conservativeMarks: number | null
  velocity: number
  acceleration: number
  isProjected: boolean
  rankName: RankName
  annotation?: string
}

export interface GatePredictorResult {
  currentMarks: number
  predictedRange: [number, number]
  currentRank: RankInfo
  currentThreshold: GateRankThreshold
  projectedExamMarks: number
  projectedRank: RankInfo
  projectedThreshold: GateRankThreshold
  velocity: number
  acceleration: number
  daysToSSS: number | null
  plateauRisk: boolean
  momentumLabel: "Accelerating" | "Steady Ascent" | "Plateau Warning" | "Declining"
  momentumColor: string
  chartData: DerivativeDataPoint[]
  daysToExam: number | null
  examDateStr: string | null
}

export interface UserProgressRow {
  user_id: string
  current_exp: number
  exam_date: string | null
  sound_enabled?: boolean
  selected_theme?: string
  unlocked_titles?: string[]
  active_title?: string | null
  unlocked_cosmetics?: string[]
  plan?: string
  custom_prompt?: string | null
  created_at?: string
  updated_at?: string
}

export interface DailyReportRow {
  id: string
  user_id: string
  report_date: string
  lectures_completed: number
  topics_revised: number
  practice_hours: number
  morning_session: boolean
  exercise_done: boolean
  distractions_level: string
  mental_state: string
  exp_gained: number
  created_at?: string
  updated_at?: string
}

export interface StreakRow {
  user_id: string
  current_streak: number
  longest_streak: number
  last_quest_date: string | null
  days_completed: number
  streak_freezes: number
  updated_at?: string
}

export interface RevisionTopicRow {
  id: string
  user_id: string
  name: string
  subject: string
  stage: number
  review_count: number
  next_review_date: string
  mastered: boolean
  difficulty: string
  created_at?: string
  updated_at?: string
}

export interface MockAttemptRow {
  id: string
  user_id: string
  exam_id?: string
  exam_name?: string
  exam_type?: string
  platform?: string | null
  marks_obtained: number
  total_marks: number
  score_pct: number
  time_spent_minutes?: number | null
  total_questions?: number | null
  questions_attempted?: number | null
  questions_correct?: number | null
  questions_incorrect?: number | null
  accuracy_pct?: number | null
  exp_gained?: number
  notes?: string | null
  attempted_at: string
}
