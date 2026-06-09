# Workspace Instructions

- Build a Next.js 15 TypeScript app for the AI-native midterm chatbot platform.
- Keep the base model frozen to `gpt-5-nano`.
- Student controls are limited to source uploads, system prompt, and LLM parameters.
- Use a static login for the exam demo: username `smajumdar`, password `admin1234`.
- Use Prisma with Postgres for relational data and pgvector for lightweight retrieval.
- Keep the grader API read-only and protected by `GRADER_API_KEY`.
- Prefer small, focused changes that preserve the current app structure.
- Validate changes with `npm run build` when possible.
