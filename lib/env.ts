import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/midterm"),
  AUTH_SECRET: z.string().default("development-secret-development-secret-development-secret"),
  APP_URL: z.string().default("http://localhost:3000"),
  GRADER_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  UPLOAD_DIR: z.string().default("./uploads")
});

export const env = envSchema.parse(process.env);
