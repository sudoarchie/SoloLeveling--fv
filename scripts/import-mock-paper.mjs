#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { IMAGE_BUCKET, validateManifest, prepareImages, databasePayload } from "./mock-paper-manifest.mjs"

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.length === 0) {
    console.log("Usage: node --env-file=.env.local scripts/import-mock-paper.mjs <paper.json> [--dry-run]")
    console.log("Auth: SUPABASE_ACCESS_TOKEN, or MOCK_IMPORT_EMAIL and MOCK_IMPORT_PASSWORD. See docs/mock-question-bank.md.")
    return
  }
  if (args.length > 2 || args.slice(1).some(arg => arg !== "--dry-run") || args[0].startsWith("--")) {
    throw new Error("Expected a paper.json path and optional --dry-run. Use --help for usage.")
  }
  const filename = path.resolve(args[0])
  if ((await stat(filename)).size > 5 * 1024 * 1024) throw new Error("The JSON manifest must be at most 5 MB")
  const manifest = validateManifest(JSON.parse(await readFile(filename, "utf8")))
  const files = await prepareImages(manifest, path.dirname(filename))
  const blobs = new Map([...files.values()].map(file => [file.name, file]))
  console.log(`Validated: ${manifest.questions.length} questions, ${blobs.size} unique images.`)
  if (args.includes("--dry-run")) {
    console.log("Dry run complete. No network calls or database changes.")
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  })
  let user
  if (token) {
    const { data, error } = await supabase.auth.getUser(token)
    if (error) throw new Error(`Authentication failed: ${error.message}`)
    user = data.user
  } else {
    const email = process.env.MOCK_IMPORT_EMAIL
    const password = process.env.MOCK_IMPORT_PASSWORD
    if (!email || !password) throw new Error("Set SUPABASE_ACCESS_TOKEN, or MOCK_IMPORT_EMAIL and MOCK_IMPORT_PASSWORD in an ignored environment file")
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`Authentication failed: ${error.message}`)
    user = data.user
  }
  if (!user) throw new Error("Sign in to import a paper")

  // Check the migration before uploading blobs. No service-role key is needed.
  const { error: schemaError } = await supabase.rpc("list_mock_exams")
  if (schemaError) throw new Error(`Cannot access the shared question bank. Apply both mock question bank migrations from supabase/migrations first. ${schemaError.message}`)
  for (const file of blobs.values()) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(`${user.id}/${file.name}`, file.bytes, {
      contentType: file.contentType, upsert: false, cacheControl: "31536000",
    })
    const duplicate = error && (String(error.statusCode) === "409" || error.message === "The resource already exists")
    if (error && !duplicate) throw new Error(`Image upload failed: ${error.message}`)
  }
  const { data, error } = await supabase.rpc("import_mock_paper", databasePayload(manifest, files, user.id))
  if (error) throw new Error(`Paper was not saved: ${error.message}. Uploaded images are retained for a safe retry.`)
  console.log(`Saved shared paper ${data.paper_id}: ${data.imported_questions} questions. Every user can open Mock tests, select ${manifest.paper.exam}, and refresh.`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Import failed")
  process.exitCode = 1
})
