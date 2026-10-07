import { AdminApiError, adminSession, errorReply, parseExam, reply, requireAdminKey } from "../../../../lib/mock-admin.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request) {
  try {
    requireAdminKey(request)
    const { supabase } = await adminSession()
    const { data, error } = await supabase.from("mock_exams")
      .select("code,name,description,created_at,updated_at").order("code")
    if (error) throw new AdminApiError(503, "Cannot read the exam catalog")
    return reply({ exams: data })
  } catch (error) { return errorReply(error) }
}

export async function POST(request) {
  try {
    requireAdminKey(request)
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
      throw new AdminApiError(415, "Send application/json")
    }
    const body = await request.text()
    if (Buffer.byteLength(body) > 16 * 1024) throw new AdminApiError(413, "Exam request exceeds 16 KB")
    let value
    try { value = JSON.parse(body) } catch { throw new AdminApiError(400, "Invalid JSON") }
    const exam = parseExam(value)
    const { supabase, user } = await adminSession()
    const { data, error } = await supabase.from("mock_exams")
      .insert({ ...exam, created_by: user.id }).select("code,name,description").single()
    if (error?.code === "23505") throw new AdminApiError(409, "Exam code already exists")
    if (error) throw new AdminApiError(502, `Could not create exam: ${error.message}`)
    return reply({ exam: data }, 201)
  } catch (error) { return errorReply(error) }
}
