import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { AdminApiError, parseExam, readPaperUpload, requireAdminKey } from "../lib/mock-admin.mjs"

const example = JSON.parse(await readFile(new URL("../public/mock-paper.example.json", import.meta.url), "utf8"))
const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")

test("admin key is required and compared exactly", () => {
  const old = process.env.MOCK_ADMIN_API_KEY
  process.env.MOCK_ADMIN_API_KEY = "a".repeat(64)
  try {
    assert.throws(() => requireAdminKey(new Request("http://localhost/api/admin/exams")),
      error => error instanceof AdminApiError && error.status === 401)
    assert.throws(() => requireAdminKey(new Request("http://localhost/api/admin/exams", {
      headers: { Authorization: `Bearer ${"b".repeat(64)}` },
    })), error => error instanceof AdminApiError && error.status === 401)
    assert.doesNotThrow(() => requireAdminKey(new Request("http://localhost/api/admin/exams", {
      headers: { Authorization: `Bearer ${"a".repeat(64)}` },
    })))
  } finally {
    if (old === undefined) delete process.env.MOCK_ADMIN_API_KEY
    else process.env.MOCK_ADMIN_API_KEY = old
  }
})

test("exam codes normalize and invalid catalog inputs are rejected", () => {
  assert.deepEqual(parseExam({ code: " gate ", name: " GATE ", description: "Exam" }),
    { code: "GATE", name: "GATE", description: "Exam" })
  assert.throws(() => parseExam({ code: "x", name: "Name" }), /2-32/)
  assert.throws(() => parseExam({ code: "JEE", name: "Name", admin: true }), /Expected an object/)
})

test("paper upload accepts validated JSON and requires bytes for image references", async () => {
  const json = new Request("http://localhost/api/admin/papers", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(example),
  })
  const result = await readPaperUpload(json)
  assert.equal(result.manifest.questions.length, 3)
  assert.equal(result.files.size, 0)
  const withImage = structuredClone(example)
  withImage.questions[0].images = [{ file: "images/q1.png", alt: "Diagram" }]
  const missing = new Request("http://localhost/api/admin/papers", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(withImage),
  })
  await assert.rejects(readPaperUpload(missing), /Use multipart/)
  const form = new FormData()
  form.set("manifest", JSON.stringify(withImage))
  form.set("images/q1.png", new Blob([imageBytes], { type: "image/png" }), "q1.png")
  const multipart = new Request("http://localhost/api/admin/papers", { method: "POST", body: form })
  const prepared = await readPaperUpload(multipart)
  assert.equal(prepared.files.get("images/q1.png").contentType, "image/png")
  assert.match(prepared.files.get("images/q1.png").name, /^[a-f0-9]{64}\.png$/)
})
