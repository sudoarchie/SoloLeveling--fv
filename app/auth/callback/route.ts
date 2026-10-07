import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// Handles Supabase email confirmation / magic-link clicks.
// Exchanges the code in the URL for a session cookie, then redirects.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const cookieStore = await import("next/headers").then((m) => m.cookies())
    const supabase = createClient(cookieStore)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Invalid or missing code — send to signin with an error flag
  return NextResponse.redirect(`${origin}/signin?error=auth`)
}
