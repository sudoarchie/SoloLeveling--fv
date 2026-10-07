import { adminSession, errorReply, readPaperUpload, reply, requireAdminKey, savePaper } from "../../../../lib/mock-admin.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request) {
  try {
    requireAdminKey(request)
    const { manifest, files } = await readPaperUpload(request)
    const { supabase, user } = await adminSession()
    const saved = await savePaper(supabase, user, manifest, files)
    return reply(saved)
  } catch (error) { return errorReply(error) }
}
