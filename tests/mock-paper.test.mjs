import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, mkdir, symlink, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { validateManifest, prepareImages, databasePayload } from "../scripts/mock-paper-manifest.mjs"

const example = JSON.parse(await readFile(new URL("../public/mock-paper.example.json", import.meta.url), "utf8"))
const fixture = () => structuredClone(example)
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")

test("normalizes exam codes so GATE imports match the shared exam selector", () => {
  const value = fixture()
  value.paper.exam = "  gate  "
  assert.equal(validateManifest(value).paper.exam, "GATE")
})

test("normalizes all three question types without changing the answer key or metadata", () => {
  const result = validateManifest(fixture())
  assert.deepEqual(result.questions.map(q => q.question_type), ["mcq", "msq", "nat"])
  assert.deepEqual(result.questions[1].correct_option_ids, ["A", "C"])
  assert.deepEqual(result.questions[1].options[0].images, [])
  assert.equal(result.questions[2].answer_min, 7)
  assert.equal(result.paper.year, 2025)
  assert.equal(result.questions[0].metadata.topic, "Data structures")
})

for (const [description, change, error] of [
  ["duplicate question numbers", m => { m.questions[1].question_number = 1 }, /Duplicate question_number/],
  ["missing answer key", m => { m.questions[0].correct_option_ids = [] }, /exactly one/],
  ["nonexistent correct option", m => { m.questions[0].correct_option_ids = ["Z"] }, /unique IDs from options/],
  ["multiple answers on MCQ", m => { m.questions[0].correct_option_ids = ["A", "B"] }, /exactly one/],
  ["duplicate answer IDs", m => { m.questions[1].correct_option_ids = ["A", "A"] }, /unique IDs/],
  ["duplicate option IDs", m => { m.questions[0].options[1].id = "A" }, /must be unique/],
  ["inverted numeric range", m => { m.questions[2].answer_min = 8 }, /answer_max/],
  ["missing numerical answer", m => { delete m.questions[2].answer_min }, /answer_min/],
  ["non-finite answer", m => { m.questions[2].answer_max = Infinity }, /answer_max/],
  ["empty question", m => { m.questions[0].question_text = " " }, /needs question_text/],
  ["empty option", m => { m.questions[0].options[0].text = "" }, /needs text/],
  ["invalid year", m => { m.paper.year = "2025" }, /paper.year/],
  ["excessive negative marks", m => { m.questions[0].negative_marks = 2 }, /negative_marks/],
  ["silent mark rounding", m => { m.questions[0].negative_marks = 1 / 3 }, /three decimal/],
  ["script source URL", m => { m.paper.source_url = "javascript:alert(1)" }, /HTTP\(S\)/],
  ["unrecognized AI field", m => { m.questions[0].correct_answer = "B" }, /not a supported field/],
  ["wrong metadata shape", m => { m.questions[0].metadata = [] }, /must be an object/],
  ["path traversal", m => { m.questions[0].images = [{ file: "../secret.png" }] }, /relative file inside/],
  ["absolute image path", m => { m.questions[0].images = [{ file: "/tmp/image.png" }] }, /relative file inside/],
]) {
  test(`rejects ${description} before writing anything`, () => {
    const value = fixture()
    change(value)
    assert.throws(() => validateManifest(value), error)
  })
}

test("prepares question and option blobs with stable hashes and owner-scoped database references", async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "mock-images-"))
  t.after(() => rm(folder, { recursive: true, force: true }))
  await mkdir(path.join(folder, "images"))
  await writeFile(path.join(folder, "images", "question.png"), png)
  await writeFile(path.join(folder, "images", "option.png"), png)
  const value = fixture()
  value.questions[0].images = [{ file: "images/question.png", alt: "Diagram" }]
  value.questions[0].options[0] = { id: "A", text: "", images: [{ file: "images/option.png", alt: "Option diagram" }] }
  const manifest = validateManifest(value)
  const files = await prepareImages(manifest, folder)
  assert.equal(files.get("images/question.png").name, files.get("images/option.png").name)
  assert.equal(files.get("images/question.png").contentType, "image/png")
  const payload = databasePayload(manifest, files, "11111111-1111-1111-1111-111111111111")
  const image = payload.p_questions[0].images[0]
  assert.match(image.path, /^11111111-1111-1111-1111-111111111111\/[a-f0-9]{64}\.png$/)
  assert.equal(image.alt, "Diagram")
  assert.equal(payload.p_questions[0].options[0].images[0].path, image.path)
  assert.equal("file" in image, false)
  assert.equal(manifest.questions[0].images[0].file, "images/question.png")
})

test("rejects a symlink escaping the paper folder, even with an innocent relative filename", async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "mock-symlink-"))
  t.after(() => rm(folder, { recursive: true, force: true }))
  await mkdir(path.join(folder, "paper"))
  await writeFile(path.join(folder, "outside.png"), png)
  await symlink(path.join(folder, "outside.png"), path.join(folder, "paper", "diagram.png"))
  const value = fixture()
  value.questions[0].images = [{ file: "diagram.png" }]
  await assert.rejects(prepareImages(validateManifest(value), path.join(folder, "paper")), /stay inside the paper folder/)
})

test("rejects HTML disguised as a PNG and missing image files", async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "mock-invalid-image-"))
  t.after(() => rm(folder, { recursive: true, force: true }))
  await writeFile(path.join(folder, "fake.png"), "<script>alert(1)</script>")
  const value = fixture()
  value.questions[0].images = [{ file: "fake.png" }]
  await assert.rejects(prepareImages(validateManifest(value), folder), /Images must be PNG/)
  value.questions[0].images = [{ file: "missing.png" }]
  await assert.rejects(prepareImages(validateManifest(value), folder), /ENOENT/)
})
