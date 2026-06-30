# Midterm Chatbot Studio

A cloud-ready Next.js app for an AI-native midterm where students upload source material, configure a chatbot, and submit it for grader queries.

## Features
- Login with fixed exam username `test` and stored password hash
- Single-user local workflow with no student account creation UI
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
- `ADMIN_API_KEY`
- `GRADER_API_KEY`
- `OPENAI_API_KEY`

OpenAI key resolution:
- Deployed environments: use runtime `OPENAI_API_KEY` (for example, injected from your platform secret settings).
- Local development: if `OPENAI_API_KEY` is not present in process env, the app falls back to `.env.local`.

Upload feature flag:
- `UPLOADS_ENABLED` controls whether source document upload/retrieval is enabled.
- Default is `true`.
- Set `UPLOADS_ENABLED=true` to enable uploads.

Upload storage backend:
- `UPLOAD_BACKEND=local` (default) stores files on local disk at `UPLOAD_DIR`.
- `UPLOAD_BACKEND=vercel-blob` stores files in Vercel Blob.
- When using `vercel-blob`, set `BLOB_READ_WRITE_TOKEN` in your environment.
- `BLOB_ACCESS` controls upload access mode for Blob storage (`private` default, set `public` only for public stores).

SMTP variables are not required for the static login flow.

## Local deployment for students

Use the Docker-based flow below unless you have a specific reason not to. It is the most reliable way to run the app locally because it starts both Postgres and the Next.js server for you.

### What you need first
1. Install Docker Desktop or the Docker Engine + Compose plugin.
2. Make sure Docker is running before you start.
3. Have access to this repository on your machine.

### Recommended Docker flow
1. Open a terminal in the repository root: `doppel-local/`.
2. Create the local runtime file if it does not already exist:

```bash
cp .env.example .env.local
```

3. Leave the defaults in `.env.local` in place for local student use.
4. Start the full stack:

```bash
docker compose up --build
```

5. Wait until the app finishes starting. The first boot can take a minute because Docker has to build the image, install dependencies, and initialize Postgres.
6. Open `http://localhost:3000/login` in your browser.
7. Sign in with the fixed local student account:
  - Username: `test`
  - Password: `test1234`
8. After login, you should land in the workspace and be able to use the chatbot flow as a student.

### What the Docker command does
- Starts Postgres on port `5432`.
- Starts the app on port `3000`.
- Runs `prisma db push` automatically inside the app container so the database schema is created.
- Stores Postgres data and uploaded files in Docker volumes so they persist between restarts.

### Stopping or resetting the local stack
1. Stop the app with `Ctrl+C` in the terminal where `docker compose up` is running.
2. If you started it in detached mode, run:

```bash
docker compose down
```

3. If you want to remove the stored local database and uploaded files as well, use:

```bash
docker compose down -v
```

### Manual local development without Docker
Use this only if you already have a Postgres database running locally.

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to point at your Postgres instance.
3. Run:

```bash
npm install
npx prisma db push
npm run dev
```

4. Open `http://localhost:3000/login` and sign in with `test` / `test1234`.

### Important notes for students
- Do not try to create new users. This local build is intentionally single-user only.
- If the login page looks empty or the app fails to load, check that Docker is running and that nothing else is already using ports `3000` or `5432`.
- If you change the database or remove the Docker volumes, the app will rebuild the schema the next time you start it.

## One-click Vercel + Postgres
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shubhobm/doppel&project-name=doppel)

After import:
1. In Vercel project Storage, create/attach Vercel Postgres.
2. Set app secrets in Environment Variables: `AUTH_SECRET`, `APP_URL`, `ADMIN_API_KEY`, `GRADER_API_KEY`, `OPENAI_API_KEY`.
3. Configure upload mode:
  - system-prompt-only: `UPLOADS_ENABLED=false`
  - uploads enabled: `UPLOADS_ENABLED=true`, `UPLOAD_BACKEND=vercel-blob`, `BLOB_READ_WRITE_TOKEN=<token>`
4. Set the Vercel Build Command to: `prisma generate && prisma db push && next build`.
5. Redeploy.

Note: `DATABASE_URL` is auto-resolved from attached Vercel Postgres variables (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL`) when not explicitly set.

If you are connecting an existing database that has no schema yet, run once from your machine:

```bash
DATABASE_URL="<your-neon-url>" npx prisma db push
```

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

## Admin API-Key Endpoints
These endpoints are intended for privileged service-to-service operations and use a static header key.

Header:
- `x-admin-key: <ADMIN_API_KEY>`

List all bots for a target user with LLM settings and files:

`POST /api/admin/key/user-bots`

Body:
```json
{
  "userId": "optional_user_id",
  "username": "optional_username"
}
```

Query any bot by any user (draft or submitted):

`POST /api/admin/key/query`

Body:
```json
{
  "botId": "bot_id",
  "question": "What is this bot configured to answer?",
  "sessionKey": "optional_session_key"
}
```
