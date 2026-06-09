# Midterm Chatbot Studio

A cloud-ready Next.js app for an AI-native midterm where students upload source material, configure a chatbot, and submit it for grader queries.

## Features
- Login with fixed exam username and stored password hash
- Logged-in forgot-password flow for updating password
- Frozen `gpt-5-nano` chat model
- Student-controlled bot names, source uploads, system prompt, and LLM parameters
- Multi-turn preview chat
- Postgres-backed storage via Prisma
- Lightweight vector retrieval using stored chunk embeddings
- Protected grader API for querying a submitted student bot
- Container-friendly deployment

## Required environment variables
Copy `.env.example` to `.env` and set:
- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_URL`
- `GRADER_API_KEY`
- `OPENAI_API_KEY`

OpenAI key resolution:
- Deployed environments: use runtime `OPENAI_API_KEY` (for example, injected from your platform secret settings).
- Local development: if `OPENAI_API_KEY` is not present in process env, the app falls back to `.env.local`.

Upload feature flag:
- `UPLOADS_ENABLED` controls whether source document upload/retrieval is enabled.
- Default is `false` (system-prompt-only bots).
- Set `UPLOADS_ENABLED=true` to enable uploads.

Upload storage backend:
- `UPLOAD_BACKEND=local` (default) stores files on local disk at `UPLOAD_DIR`.
- `UPLOAD_BACKEND=vercel-blob` stores files in Vercel Blob.
- When using `vercel-blob`, set `BLOB_READ_WRITE_TOKEN` in your environment.

SMTP variables are not required for the static login flow.

## Development
1. Install dependencies.
2. Run Prisma generate and migrations.
3. Put your local OpenAI key in `.env.local` as `OPENAI_API_KEY`.
4. Start the app with `npm run dev`.

## Local Docker deployment
1. Copy `.env.example` to `.env.local` if you want to run outside Docker.
2. Start the stack with `docker compose up --build`.
3. Open `http://localhost:3000` once the app is ready.

## Grader API
`POST /api/grader/query`

Headers:
- `x-grader-key: <GRADER_API_KEY>`

Body:
```json
{
  "studentId": "student_bot_id",
  "question": "Explain the role of RAG in enterprise QA."
}
```
