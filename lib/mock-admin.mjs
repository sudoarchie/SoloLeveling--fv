import { createHash, timingSafeEqual } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { IMAGE_BUCKET, MAX_IMAGE_BYTES, allImages, imageFormat, databasePayload, validateManifest } from "../scripts/mock-paper-manifest.mjs"

export class AdminApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export function errorReply(error) {
  if (error instanceof AdminApiError) return reply({ error: error.message }, error.status)
  console.error("Mock admin API error", error instanceof Error ? error.message : "unknown error")
  return reply({ error: "Admin API request failed" }, 500)
}

export function requireAdminKey(request) {
  const configured = process.env.MOCK_ADMIN_API_KEY
  const header = request.headers.get("authorization") ?? ""
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!configured || !/^[a-f0-9]{64}$/i.test(configured) || !/^[a-f0-9]{64}$/i.test(supplied)) {
    throw new AdminApiError(401, "A valid admin Bearer key is required")
  }
  const expectedBytes = Buffer.from(configured, "hex")
  const suppliedBytes = Buffer.from(supplied, "hex")
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new AdminApiError(401, "A valid admin Bearer key is required")
  }
}

export async function adminSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const email = process.env.MOCK_ADMIN_UPLOAD_EMAIL
  const password = process.env.MOCK_ADMIN_UPLOAD_PASSWORD
  if (!url || !publishableKey || !email || !password) {
    throw new AdminApiError(503, "Configure the server-side Supabase uploader credentials")
  }
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new AdminApiError(503, "The configured uploader account could not sign in")
  const role = await supabase.rpc("is_mock_bank_admin")
  if (role.error) throw new AdminApiError(503, "Apply the mock admin migration in Supabase")
  if (role.data !== true) throw new AdminApiError(403, "The configured uploader is not registered as a mock bank admin")
  return { supabase, user: data.user }
}

export function parseExam(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !["code", "name", "description"].includes(key))) {
    throw new AdminApiError(400, "Expected an object with code, name, and optional description")
  }
  const code = typeof value.code === "string" ? value.code.trim().toUpperCase() : ""
  const name = typeof value.name === "string" ? value.name.trim() : ""
  const description = value.description === undefined ? "" : value.description
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) || !name || name.length > 200 ||
      typeof description !== "string" || description.length > 2000) {
    throw new AdminApiError(400, "Exam needs a 2-32 character code, a name, and an optional description")
  }
  return { code, name, description }
}

const MAX_JSON_BYTES = 5 * 1024 * 1024
const MAX_REQUEST_BYTES = 110 * 1024 * 1024

export async function readPaperUpload(request) {
  const size = Number(request.headers.get("content-length") ?? 0)
  if (size > MAX_REQUEST_BYTES) throw new AdminApiError(413, "Upload exceeds 110 MB")
  const contentType = request.headers.get("content-type") ?? ""
  let raw, form = null
  if (contentType.startsWith("application/json")) {
    const body = await request.text()
    if (Buffer.byteLength(body) > MAX_JSON_BYTES) throw new AdminApiError(413, "Manifest exceeds 5 MB")
    try { raw = JSON.parse(body) } catch { throw new AdminApiError(400, "Invalid JSON manifest") }
  } else if (contentType.startsWith("multipart/form-data")) {
    try { form = await request.formData() } catch { throw new AdminApiError(400, "Invalid multipart upload") }
    const manifestParts = form.getAll("manifest")
    if (manifestParts.length !== 1) throw new AdminApiError(400, "Provide one manifest form field")
    const source = manifestParts[0]
    const body = typeof source === "string" ? source : await source.text()
    if (Buffer.byteLength(body) > MAX_JSON_BYTES) throw new AdminApiError(413, "Manifest exceeds 5 MB")
    try { raw = JSON.parse(body) } catch { throw new AdminApiError(400, "Invalid JSON manifest") }
  } else {
    throw new AdminApiError(415, "Send application/json or multipart/form-data")
  }
  let manifest
  try { manifest = validateManifest(raw) } catch (error) {
    throw new AdminApiError(400, error instanceof Error ? error.message : "Invalid manifest")
  }
  const expected = new Set(allImages(manifest).map(image => image.file))
  if (expected.size && !form) throw new AdminApiError(400, "Use multipart/form-data when the manifest references images")
  if (form && [...form.keys()].some(key => key !== "manifest" && !expected.has(key))) {
    throw new AdminApiError(400, "Unexpected image form field")
  }
  const files = new Map()
  let totalBytes = 0
  for (const file of expected) {
    const uploads = form.getAll(file)
    if (uploads.length !== 1 || typeof uploads[0] === "string") {
      throw new AdminApiError(400, `Provide exactly one image form field named ${file}`)
    }
    const bytes = Buffer.from(await uploads[0].arrayBuffer())
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new AdminApiError(413, `Image must be between 1 byte and 5 MB: ${file}`)
    }
    totalBytes += bytes.length
    if (totalBytes > 100 * 1024 * 1024) throw new AdminApiError(413, "Images exceed 100 MB")
    let extension, contentType
    try { [extension, contentType] = imageFormat(bytes) } catch {
      throw new AdminApiError(400, `Unsupported image format: ${file}`)
    }
    files.set(file, { bytes, contentType,
      name: `${createHash("sha256").update(bytes).digest("hex")}.${extension}` })
  }
  return { manifest, files }
}

export async function savePaper(supabase, user, manifest, files) {
  const schema = await supabase.rpc("list_mock_exams")
  if (schema.error) throw new AdminApiError(503, "Apply the shared mock bank migration in Supabase")
  const exam = await supabase.from("mock_exams").select("code").eq("code", manifest.paper.exam).maybeSingle()
  if (exam.error) throw new AdminApiError(503, "Cannot read the exam catalog")
  if (!exam.data) throw new AdminApiError(404, `Create exam ${manifest.paper.exam} before importing this paper`)
  const blobs = new Map([...files.values()].map(file => [file.name, file]))
  for (const file of blobs.values()) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(`${user.id}/${file.name}`, file.bytes, {
      contentType: file.contentType, upsert: false, cacheControl: "31536000",
    })
    const duplicate = error && (String(error.statusCode) === "409" || error.message === "The resource already exists")
    if (error && !duplicate) throw new AdminApiError(502, `Image upload failed: ${error.message}`)
  }
  const { data, error } = await supabase.rpc("import_mock_paper", databasePayload(manifest, files, user.id))
  if (error) throw new AdminApiError(502, `Paper import failed: ${error.message}. Uploaded images can be reused on retry.`)
  return { paper_id: data.paper_id, imported_questions: data.imported_questions,
    exam: manifest.paper.exam, source_key: manifest.paper.source_key, image_count: blobs.size }
}
