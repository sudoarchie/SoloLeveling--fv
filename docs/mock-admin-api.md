# Mock question bank admin API

The API creates exams and imports validated question papers for one configured uploader account. Every signed-in app user can browse published papers under **Mock tests → Exam**. Only callers with the separate admin API key can use these HTTP endpoints. The uploader account is registered as a mock bank admin in the database; its app password and the API key stay on the server.

## One-time setup

Apply these migrations in the app's Supabase SQL Editor, in order:

1. `supabase/migrations/202610070001_mock_question_bank.sql` if it is not installed.
2. `supabase/migrations/202610070002_shared_mock_question_bank.sql`.
3. `supabase/migrations/202610070003_mock_admin_api.sql`.

The `solo` Supabase project has all three migrations installed as of 2026-10-07. For another project, register the designated uploader account in the same SQL Editor after applying the migrations:

```sql
insert into public.mock_bank_admins (user_id)
select id from auth.users where email = '<uploader-email>'
on conflict (user_id) do nothing;
```

The insert must add one row. If it adds zero, check that the uploader account exists in this Supabase project and that the email is exact. The app's normal sign-in is not a database administrator; this SQL setup requires the project owner or another database administrator.

In the app's ignored `.env.local`, set **server-side** variables:

```dotenv
MOCK_ADMIN_API_KEY=<64-character-random-hex-key>
MOCK_ADMIN_UPLOAD_EMAIL=<uploader-email>
MOCK_ADMIN_UPLOAD_PASSWORD=<uploader-password>
```

The existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are also required. Keep all three admin values out of `NEXT_PUBLIC_*`, source control, URLs, and browser code. The API key is generated locally when the API is installed; read it from `.env.local`. Set the same variables in the deployment environment and restart or redeploy the server after changes. Rotate the API key by replacing it and restarting the server. Rotate the uploader account password after it has been shared in chat, then update the server environment.

The API requires `Authorization: Bearer <MOCK_ADMIN_API_KEY>`. Its routes bypass the app's cookie-login middleware and verify the key before parsing uploads. A user session without the key cannot use them; the key alone does not grant Supabase SQL administration. Database row policies also restrict exam creation to registered bank admins. Requests and responses are never cached.

## Endpoints

### `GET /api/admin/exams`

List exam catalog entries. Requires the admin Bearer key.

### `POST /api/admin/exams`

Create an exam. JSON body:

```json
{ "code": "GATE", "name": "Graduate Aptitude Test in Engineering", "description": "Optional" }
```

`code` is normalized to uppercase and may contain 2–32 letters, digits, `_`, or `-`. Duplicate codes return 409. GATE is seeded by the migration, so use `GET` before trying to create it again. Exams appear in the app selector even before they have papers.

### `POST /api/admin/papers`

Import or update 1–500 questions using the same schema-version-1 manifest as `docs/mock-question-bank.md`. `paper.exam` must match an existing exam code. Submit `application/json` if there are no images, or `multipart/form-data` with one `manifest` field and one image field for every distinct relative image path referenced by `question.images` or `options[].images`. For example, if the manifest references `images/q12-diagram.png`, the multipart field must be named exactly `images/q12-diagram.png`.

The server checks the manifest and image signatures, uploads images to the private Storage bucket, then calls the existing transactional `import_mock_paper` RPC. Repeating an import with the same uploader, source key, and question numbers updates those questions; questions absent from a chunk remain. Uploaded blobs can remain if the database transaction fails; a retry reuses matching bytes.

Limits: 5 MB manifest, 5 MB per image, 100 MB total referenced image bytes, and 110 MB request body. Supported images: PNG, JPEG, WebP, GIF. An unknown exam returns 404, missing/invalid inputs return 4xx, and unapplied migrations or server credential failures return 503.

## Call it from this project

Run the app and use the included client. It reads `MOCK_ADMIN_API_KEY` from `.env.local` and defaults to `http://localhost:3000`:

```sh
node --env-file=.env.local scripts/mock-admin-client.mjs list-exams
node --env-file=.env.local scripts/mock-admin-client.mjs create-exam JEE "Joint Entrance Examination"
node --env-file=.env.local scripts/mock-admin-client.mjs import-paper /home/archie/mockdata/papers/gate-cs-2025-session-1/paper.json
```

For a deployed API, set `MOCK_ADMIN_API_URL=https://your-app.example` in the client's environment. The client sends all referenced local image files automatically. It never prints the API key.

Direct HTTP example, using an environment variable already set in your shell:

```sh
curl -X POST https://your-app.example/api/admin/exams \
  -H "Authorization: Bearer $MOCK_ADMIN_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"code":"JEE","name":"Joint Entrance Examination"}'
```

For a text-only paper, send the manifest JSON body with `Content-Type: application/json`. For a paper with images, the project client above handles the multipart upload and local file validation.
