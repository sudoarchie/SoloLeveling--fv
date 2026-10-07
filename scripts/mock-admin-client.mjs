#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import path from "node:path"
import { allImages, prepareImages, validateManifest } from "./mock-paper-manifest.mjs"

const [action, ...args] = process.argv.slice(2)
const baseUrl = process.env.MOCK_ADMIN_API_URL ?? "http://localhost:3000"
const apiKey = process.env.MOCK_ADMIN_API_KEY
if (!apiKey) throw new Error("Set MOCK_ADMIN_API_KEY in the environment")

async function send(endpoint, options = {}) {
  const response = await fetch(new URL(endpoint, baseUrl), {
    ...options,
    headers: { Authorization: `Bearer ${apiKey}`, ...options.headers },
    cache: "no-store",
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error ?? "request failed"}`)
  console.log(JSON.stringify(body, null, 2))
}

if (action === "list-exams" && args.length === 0) {
  await send("/api/admin/exams")
} else if (action === "create-exam" && args.length === 2) {
  await send("/api/admin/exams", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: args[0], name: args[1] }),
  })
} else if (action === "import-paper" && args.length === 1) {
  const filename = path.resolve(args[0])
  const manifest = validateManifest(JSON.parse(await readFile(filename, "utf8")))
  const images = allImages(manifest)
  if (images.length === 0) {
    await send("/api/admin/papers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(manifest),
    })
  } else {
    const blobs = await prepareImages(manifest, path.dirname(filename))
    const form = new FormData()
    form.set("manifest", JSON.stringify(manifest))
    for (const [file, blob] of blobs) {
      form.set(file, new Blob([blob.bytes], { type: blob.contentType }), path.basename(file))
    }
    await send("/api/admin/papers", { method: "POST", body: form })
  }
} else {
  console.error("Usage: node --env-file=.env.local scripts/mock-admin-client.mjs list-exams | create-exam CODE NAME | import-paper PATH")
  process.exitCode = 2
}
