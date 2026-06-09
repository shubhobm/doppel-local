# Demo Course Notes

This is a small seeded source bundle for the midterm chatbot demo.

## Key facts

- The chatbot app is built with Next.js 15 and TypeScript.
- Student bots use Prisma with Postgres.
- Retrieval uses embeddings and chunked document context.
- The model is frozen to gpt-5-nano for the exam demo.
- Students may change the system prompt and LLM parameters, upload sources, and submit bots for grading.
- Submitted bots can be reverted back to draft.

## Grading behavior

- The grader API is read-only.
- Grading calls require the GRADER_API_KEY header.
- Only submitted bots should be graded.
- The demo bot should answer directly from the uploaded notes when asked about the platform.

## Suggested sample questions

- What stack powers the chatbot platform?
- Which model is frozen for the exam?
- What can students change before submission?
- Can a submitted bot be reverted?