# Mock question bank: AI ingestion guide

This is a shared timed mock test bank: upload a paper once, and every signed-in user can select its exam (for example, **GATE**) and take the paper under its configured time limit. The importing account retains permission to edit or delete its source papers. Users only need their own normal app login; they do not need the uploader's credentials. Responses autosave, the database enforces deadlines and grading, answer keys appear only after completion, and attempt results are retained for performance analysis.

## One-time setup

Run these migrations in your project's Supabase SQL Editor, in order:

1. [`202610070001_mock_question_bank.sql`](../supabase/migrations/202610070001_mock_question_bank.sql) — tables, import function, and image bucket.
2. [`202610070002_shared_mock_question_bank.sql`](../supabase/migrations/202610070002_shared_mock_question_bank.sql) — shared read access, uploader-only writes, normalized exam codes, and exam selection.
3. [`202610070003_mock_admin_api.sql`](../supabase/migrations/202610070003_mock_admin_api.sql) — admin API support.
4. [`202610070004_timed_mock_exams.sql`](../supabase/migrations/202610070004_timed_mock_exams.sql) — private attempt snapshots, server-enforced timers, response saving, grading, and history.
5. [`202610080004_timed_mock_exam_exp.sql`](../supabase/migrations/202610080004_timed_mock_exam_exp.sql) — atomic rewards of up to 2,500 EXP, with coverage and personal-best safeguards plus duplicate-award protection.

Apply any missing migrations in order. The timed migration replaces direct shared question reads with a safe catalog and database functions, so active tests cannot read answer keys from the browser. Existing papers do not need to be re-imported.

The resulting setup includes:

- `mock_papers`: owner, stable source key, title, exam, **year**, subject, duration, source URL, JSON metadata.
- `mock_questions`: paper, number, type, question text, options, correct option IDs or numerical answer range, marks, explanation, JSON metadata, image references.
- `mock-question-images`: a **private Supabase Storage bucket** for the actual image bytes. All signed-in users can read these images via signed URLs. JSON/DB rows hold object paths, not blobs or expiring URLs.
- `import_mock_paper`: a transactional import function, accessible only to authenticated users. RLS restricts source rows and writes to the uploader; other users receive the safe paper catalog and exam payloads through dedicated functions.
- `list_mock_exams`: lists distinct exams across the shared bank. GATE is always available in the app's exam selector, even before its first import.
- Timed exam functions: start or resume a fixed-deadline attempt, save validated responses, submit or time out, grade against a frozen paper snapshot, and list the signed-in user's attempt history.

The web app uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No service-role key is needed. The migration must be applied to the same Supabase project as the app.

## Instructions to give your AI

> Read docs/mock-question-bank.md and public/mock-paper.example.json. Extract the supplied question paper and answer key into a schema_version 1 JSON manifest. Set paper.exam to "GATE" for GATE papers, and put the branch/subject in paper.subject. Preserve original numbering, question wording, option labels, equations, diagrams, year, and source details. Save image crops inside the paper folder and reference them with relative file paths. Do not invent missing answers or silently omit diagrams. Flag uncertain extraction for review before importing. Run the dry-run validator, fix errors, then import with the configured uploader account. Uploaded content is shared with every signed-in user.

The scraper/extractor is supplied by you or your AI; this project provides validation, uploads, persistence, timed delivery, and grading. Plain text, line breaks, Unicode equations, and raw LaTeX strings are retained; the exam screen displays text without executing HTML or rendering LaTeX. Crop complex formulae as images if needed.

Recommended folder layout:

```text
papers/gate-cs-2025-session-1/
  paper.json
  images/
    q12-diagram.png
    q15-option-a.png
```

Start with [`public/mock-paper.example.json`](../public/mock-paper.example.json), which is a runnable, synthetic three-question example covering MCQ, MSQ, and numerical questions.

## Image format

Question `images` and each option's `images` use this same format in the local JSON:

```json
{
  "file": "images/q12-diagram.png",
  "alt": "Directed graph with vertices A, B, and C and three labelled edges"
}
```

For an option that is entirely an image:

```json
{
  "id": "A",
  "text": "",
  "images": [{ "file": "images/q15-option-a.png", "alt": "Option A circuit diagram" }]
}
```

Download/crop images locally first. Remote URLs, base64 blobs, absolute paths, and paths outside the paper folder are not accepted by the importer. Use PNG, JPEG, WebP, or GIF, at most 5 MB per image and 100 MB per import. PDF/SVG crops must be converted to a supported raster format. Up to 20 images are allowed per question/option.

The importer checks file signatures, uploads to `<uploader-id>/<sha256-of-bytes>.<extension>`, and stores `{ "path": "...", "alt": "..." }` in the database. Repeated bytes from the same uploader reuse the same object. Every signed-in user can obtain temporary signed image URLs; the exam screen signs them for up to one day so they remain visible throughout long tests. The bucket stays private to anonymous visitors. See [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Manifest rules

| Field | Rules |
| --- | --- |
| `schema_version` | Required integer `1`. |
| `paper.source_key` | Stable identifier, e.g. `gate-cs-2025-session-1`. Letters, digits, `_`, `-`; max 160 characters. Include session/shift so different papers do not overwrite each other. |
| `paper.title`, `paper.exam`, `paper.year` | Required. Use `"exam": "GATE"` for GATE papers. Exam codes are trimmed and uppercased in both the importer and database, so `gate` and ` GATE ` become `GATE`. Year is an integer, 1900–2100, applying to every question in this paper. |
| `paper.subject` | Optional string. |
| `paper.duration_minutes` | Integer 1–1440; defaults to 180. |
| `paper.source_url` | Optional HTTP(S) URL to the original source. |
| `metadata` | Optional JSON object on both paper and questions. Store page number, session, topic, difficulty, source question ID, extraction confidence, original OCR, etc. |
| `question_number` | Unique integer 1–10000 within the paper. Use stable numbering across imports. |
| `question_type` | Required `mcq`, `msq`, or `nat`. |
| `question_text`, `images` | At least nonempty text or one image. Text is preserved, not interpreted as HTML. |
| `options` | MCQ/MSQ: 2–10 entries with unique `id`, `text`, and/or `images`. IDs are case-sensitive strings such as `A` or `B`. NAT: empty array. |
| `correct_option_ids` | MCQ: exactly one valid option ID. MSQ: one or more valid option IDs, no duplicates. NAT: empty array. Never guess an answer key. |
| `answer_min`, `answer_max` | NAT only, required finite numbers in ascending order. Use the same value for an exact answer. |
| `marks`, `negative_marks` | Defaults: 1 and 0. Marks must be positive; penalty must be between 0 and marks. At most 3 decimal places (e.g. `0.333`). |
| `explanation` | Optional text. |

Unknown fields are rejected to catch AI field-name mistakes; put extra information in `metadata`. The importer accepts 1–500 questions and at most 5 MB of JSON per run.

## Validate without credentials or network

Requires Node.js 20.6+ and installed project dependencies (`pnpm install`). Run from the repository root:

```sh
node scripts/import-mock-paper.mjs ./papers/gate-cs-2025-session-1/paper.json --dry-run
```

This checks the complete manifest and every referenced image before making changes. To try the text-only example:

```sh
node scripts/import-mock-paper.mjs public/mock-paper.example.json --dry-run
```

## Authenticate and import

Use your app account as the uploader. Its email/password authorize uploads and later edits; they do not limit who can take the papers. Everyone else just selects **Mock tests → GATE** using their own app account. Put uploader credentials in an ignored `.env.import.local` file; `.env*` is already gitignored. Do not paste credentials into manifests, commit them, or add them to browser-facing `NEXT_PUBLIC_*` variables.

```dotenv
MOCK_IMPORT_EMAIL=your-account-email
MOCK_IMPORT_PASSWORD=your-account-password
```

Alternatively, supply `SUPABASE_ACCESS_TOKEN` containing a valid **user session JWT** (not a Supabase management API token). The token takes precedence; replace it when it expires. Password sign-in is intended for accounts without MFA; MFA accounts should use a session token with the required assurance level.

```sh
node --env-file=.env.local --env-file=.env.import.local scripts/import-mock-paper.mjs ./papers/gate-cs-2025-session-1/paper.json
```

In any signed-in account, open **Mock tests → Exam: GATE → Start test**. Select a different exam to view its papers. The test shows one question at a time, a fixed timer, response status, review flags, and a question navigator. Submission opens the scored result and answer review.

Imports merge by `(uploader user_id, source_key)` and `(paper_id, question_number)`. Use the same uploader account when updating a paper; another account importing the same source key creates a separate paper instead of overwriting it. Re-importing updates all supplied fields for those rows for every reader; omitted optional fields use defaults. Questions absent from the new file are **retained**, so large papers can be imported in chunks. This operation does not delete old questions or score history.

All database writes for one manifest occur in one transaction. A rejected question rolls back the paper and questions. Storage uploads occur before that transaction; uploaded files remain if the database call fails and are reused on retry. Obsolete/unreferenced blobs are retained; remove them through Supabase administration only after checking references.

## For custom ingestion clients

Follow the same normalization in `scripts/mock-paper-manifest.mjs`. Upload image bytes to the private bucket using an authenticated user client, replace each `{file, alt}` with `{path, alt}`, and call:

```js
await supabase.rpc("import_mock_paper", {
  p_paper: normalizedPaper,
  p_questions: normalizedQuestions
})
```

The RPC derives write ownership from the session; it does not accept a user ID override. Uploaders can read and edit their source rows. Other authenticated accounts see the limited paper catalog and receive question prompts through the timed exam functions; answer keys are returned only for completed attempts. Image uploads still require the uploader's folder, while signed-in users can read referenced images. Schema checks enforce valid options, answer cardinality, image path ownership, and same-uploader paper/question relationships even for direct database inserts. A direct client must upload referenced blobs first; the database validates paths but does not verify blob existence. Avoid storing signed URLs, which expire.

## Verification

Run `pnpm test:mock-bank`. Importer tests need only Node; the SQL integration test additionally needs local `initdb` and `postgres` binaries. It uses a disposable database to check the migration, re-runs, rollback, constraints, and the installed access-policy expressions. Single-user PostgreSQL does not enforce RLS, so full RLS and Storage HTTP behavior should also be checked with two accounts in a Supabase test project.

## Admin HTTP API

To create an exam and import a paper over HTTP with a separate admin key, see [Mock question bank admin API](mock-admin-api.md). The existing CLI importer remains available.
