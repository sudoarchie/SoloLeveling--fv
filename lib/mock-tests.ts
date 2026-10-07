export const MOCK_IMAGE_BUCKET = "mock-question-images"

export interface QuestionImage {
  path: string
  alt: string
}

export interface QuestionOption {
  id: string
  text: string
  images: QuestionImage[]
}

export interface MockPaper {
  id: string
  title: string
  exam: string
  year: number
  subject: string
  duration_minutes: number
  question_count: number
}

export interface MockQuestion {
  id: string
  question_number: number
  question_type: "mcq" | "msq" | "nat"
  question_text: string
  images: QuestionImage[]
  options: QuestionOption[]
  // Answer keys are returned only after the attempt is completed.
  correct_option_ids?: string[]
  answer_min?: number | null
  answer_max?: number | null
  marks: number
  negative_marks: number
  explanation?: string
}

export interface MockAnswer {
  option_ids: string[]
  numeric_answer: string | null
  marked_for_review: boolean
}

export interface MockResult {
  score: number
  total_marks: number
  percentage: number
  correct: number
  incorrect: number
  unanswered: number
  question_results: Record<string, { status: "correct" | "incorrect" | "unanswered"; awarded_marks: number }>
}

export interface MockAttemptSummary {
  id: string
  paper_id: string | null
  title: string
  exam: string
  status: "in_progress" | "completed"
  started_at: string
  deadline_at: string
  completed_at: string | null
  score: number | null
  total_marks: number | null
}

export interface MockAttempt extends Omit<MockAttemptSummary, "score" | "total_marks"> {
  year: number
  duration_minutes: number
  server_now: string
  completion_reason: "submitted" | "timeout" | null
  questions: MockQuestion[]
  answers: Record<string, MockAnswer>
  result: MockResult | null
}

export const emptyMockAnswer = (): MockAnswer => ({ option_ids: [], numeric_answer: null, marked_for_review: false })

export function hasMockAnswer(question: MockQuestion, answer?: MockAnswer) {
  if (!answer) return false
  if (question.question_type !== "nat") return answer.option_ids.length > 0
  const value = answer.numeric_answer?.trim() ?? ""
  return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d{1,3})?$/.test(value)
    && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1e12
}

export function formatExamTime(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}

export function questionBankError(error: { code?: string; message: string }) {
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(error.code ?? "")) {
    return "Mock tests need their database setup. Apply the migrations through 202610070004_timed_mock_exams.sql in the project’s setup guide, then refresh."
  }
  return error.message
}

export function mockError(error: unknown) {
  return questionBankError(error && typeof error === "object" && "message" in error
    ? error as { code?: string; message: string }
    : { message: "Couldn’t connect. Check your connection and try again." })
}
