import { createHash } from "node:crypto"
import { readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"

export const IMAGE_BUCKET = "mock-question-images"
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function object(value, location, allowed) {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), `${location} must be an object`)
  if (allowed) {
    for (const key of Object.keys(value)) {
      requireValue(allowed.includes(key), `${location}.${key} is not a supported field; put extra data in metadata`)
    }
  }
  return value
}

function text(value, location, max = 100000) {
  requireValue(typeof value === "string" && value.length <= max, `${location} must be a string of at most ${max} characters`)
  return value.trim()
}

function number(value, location, min, max, integer = false) {
  requireValue(typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)), `${location} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}`)
  return value
}

function images(value = [], location) {
  requireValue(Array.isArray(value) && value.length <= 20, `${location} must be an array of at most 20 images`)
  return value.map((image, index) => {
    const label = `${location}[${index}]`
    object(image, label, ["file", "alt"])
    const file = text(image.file, `${label}.file`, 1024)
    requireValue(file && !path.isAbsolute(file) && !file.includes("\\") && !file.split("/").includes(".."), `${label}.file must be a relative file inside the paper folder`)
    return { file, alt: text(image.alt ?? "", `${label}.alt`, 2000) }
  })
}

/** Validate the AI's output before any authentication or upload. Never guess answers. */
export function validateManifest(value) {
  object(value, "manifest", ["schema_version", "paper", "questions"])
  requireValue(value.schema_version === 1, "schema_version must be 1")
  const p = object(value.paper, "paper", ["source_key", "title", "exam", "year", "subject", "duration_minutes", "source_url", "metadata"])
  const sourceKey = text(p.source_key, "paper.source_key", 160)
  requireValue(/^[a-zA-Z0-9_-]+$/.test(sourceKey), "paper.source_key must use only letters, numbers, underscores, and hyphens")
  const title = text(p.title, "paper.title", 300)
  const exam = text(p.exam, "paper.exam", 100).toUpperCase()
  requireValue(title && exam, "paper.title and paper.exam are required")
  const sourceUrl = p.source_url == null ? null : text(p.source_url, "paper.source_url", 4096)
  if (sourceUrl) {
    let url
    try { url = new URL(sourceUrl) } catch { throw new Error("paper.source_url must be an HTTP(S) URL") }
    requireValue(["http:", "https:"].includes(url.protocol), "paper.source_url must be an HTTP(S) URL")
  }
  const paper = {
    source_key: sourceKey, title, exam,
    year: number(p.year, "paper.year", 1900, 2100, true),
    subject: text(p.subject ?? "", "paper.subject", 300),
    duration_minutes: number(p.duration_minutes ?? 180, "paper.duration_minutes", 1, 1440, true),
    source_url: sourceUrl || null,
    metadata: object(p.metadata ?? {}, "paper.metadata"),
  }
  requireValue(Array.isArray(value.questions) && value.questions.length >= 1 && value.questions.length <= 500, "questions must contain between 1 and 500 entries")
  const numbers = new Set()
  const questions = value.questions.map((entry, index) => {
    const label = `questions[${index}]`
    const q = object(entry, label, ["question_number", "question_type", "question_text", "images", "options", "correct_option_ids", "answer_min", "answer_max", "marks", "negative_marks", "explanation", "metadata"])
    const questionNumber = number(q.question_number, `${label}.question_number`, 1, 10000, true)
    requireValue(!numbers.has(questionNumber), `Duplicate question_number: ${questionNumber}`)
    numbers.add(questionNumber)
    requireValue(["mcq", "msq", "nat"].includes(q.question_type), `${label}.question_type must be mcq, msq, or nat`)
    const questionText = text(q.question_text ?? "", `${label}.question_text`)
    const questionImages = images(q.images, `${label}.images`)
    requireValue(questionText || questionImages.length, `${label} needs question_text or an image`)
    const sourceOptions = q.options ?? []
    requireValue(Array.isArray(sourceOptions), `${label}.options must be an array`)
    const ids = new Set()
    const options = sourceOptions.map((entry, optionIndex) => {
      const optionLabel = `${label}.options[${optionIndex}]`
      const option = object(entry, optionLabel, ["id", "text", "images"])
      const id = text(option.id, `${optionLabel}.id`, 16)
      requireValue(/^[A-Za-z0-9_-]+$/.test(id) && !ids.has(id), `${optionLabel}.id must be unique and use letters, numbers, underscores, or hyphens`)
      ids.add(id)
      const optionText = text(option.text ?? "", `${optionLabel}.text`)
      const optionImages = images(option.images, `${optionLabel}.images`)
      requireValue(optionText || optionImages.length, `${optionLabel} needs text or an image`)
      return { id, text: optionText, images: optionImages }
    })
    const answers = q.correct_option_ids ?? []
    requireValue(Array.isArray(answers) && answers.every(id => typeof id === "string" && ids.has(id)) && new Set(answers).size === answers.length, `${label}.correct_option_ids must contain unique IDs from options`)
    let answerMin = null, answerMax = null
    if (q.question_type === "nat") {
      requireValue(options.length === 0 && answers.length === 0, `${label}: NAT questions must have no options or correct_option_ids`)
      answerMin = number(q.answer_min, `${label}.answer_min`, -1e12, 1e12)
      answerMax = number(q.answer_max, `${label}.answer_max`, answerMin, 1e12)
    } else {
      requireValue(options.length >= 2 && options.length <= 10, `${label} needs 2–10 options`)
      requireValue(q.question_type === "mcq" ? answers.length === 1 : answers.length >= 1, `${label}: MCQ needs exactly one correct option; MSQ needs at least one`)
      requireValue(q.answer_min == null && q.answer_max == null, `${label}: numeric answers are only for NAT questions`)
    }
    const marks = number(q.marks ?? 1, `${label}.marks`, 0.001, 1000)
    const negativeMarks = number(q.negative_marks ?? 0, `${label}.negative_marks`, 0, marks)
    for (const amount of [marks, negativeMarks]) {
      requireValue(Math.abs(amount * 1000 - Math.round(amount * 1000)) < 1e-7, `${label}: marks support at most three decimal places`)
    }
    return {
      question_number: questionNumber, question_type: q.question_type,
      question_text: questionText, images: questionImages, options,
      correct_option_ids: answers, answer_min: answerMin, answer_max: answerMax,
      marks, negative_marks: negativeMarks,
      explanation: text(q.explanation ?? "", `${label}.explanation`),
      metadata: object(q.metadata ?? {}, `${label}.metadata`),
    }
  })
  return { schema_version: 1, paper, questions }
}

export function imageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ["png", "image/png"]
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ["jpg", "image/jpeg"]
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return ["gif", "image/gif"]
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return ["webp", "image/webp"]
  throw new Error("Images must be PNG, JPEG, WebP, or GIF. Convert PDF/SVG crops to PNG first.")
}

export function allImages(manifest) {
  return manifest.questions.flatMap(q => [...q.images, ...q.options.flatMap(o => o.images)])
}

/** Resolve every image first so missing/invalid files cannot cause a partial upload. */
export async function prepareImages(manifest, folder) {
  const root = await realpath(folder)
  const files = new Map()
  let totalBytes = 0
  for (const { file } of allImages(manifest)) {
    if (files.has(file)) continue
    const absolute = await realpath(path.resolve(root, file))
    const relative = path.relative(root, absolute)
    requireValue(relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative), `Image must stay inside the paper folder: ${file}`)
    const info = await stat(absolute)
    requireValue(info.isFile() && info.size > 0 && info.size <= MAX_IMAGE_BYTES, `Image must be a file between 1 byte and 5 MB: ${file}`)
    totalBytes += info.size
    requireValue(totalBytes <= 100 * 1024 * 1024, "One import may contain at most 100 MB of image files")
    const bytes = await readFile(absolute)
    const [extension, contentType] = imageFormat(bytes)
    const hash = createHash("sha256").update(bytes).digest("hex")
    files.set(file, { bytes, contentType, name: `${hash}.${extension}` })
  }
  return files
}

export function databasePayload(manifest, files, userId) {
  const convert = entries => entries.map(image => {
    const file = files.get(image.file)
    requireValue(file, `Image was not prepared: ${image.file}`)
    return { path: `${userId}/${file.name}`, alt: image.alt }
  })
  return {
    p_paper: manifest.paper,
    p_questions: manifest.questions.map(q => ({
      ...q, images: convert(q.images),
      options: q.options.map(o => ({ ...o, images: convert(o.images) })),
    })),
  }
}
