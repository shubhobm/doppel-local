import { z } from "zod";
import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  const vercelPostgresUrl =
    process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (vercelPostgresUrl) {
    process.env.DATABASE_URL = vercelPostgresUrl;
  }
}

function readEnvValueFromFile(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const currentKey = trimmed.slice(0, separatorIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }

  return "";
}

const localOpenAIKey =
  process.env.NODE_ENV !== "production" && !process.env.OPENAI_API_KEY
    ? readEnvValueFromFile(path.join(process.cwd(), ".env.local"), "OPENAI_API_KEY")
    : "";

const trueValues = new Set(["1", "true", "yes", "on"]);

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/midterm"),
  AUTH_SECRET: z.string().default("development-secret-development-secret-development-secret"),
  APP_URL: z.string().default("http://localhost:3000"),
  GRADER_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  UPLOADS_ENABLED: z.string().default("true").transform((value) => trueValues.has(value.toLowerCase())),
  UPLOAD_BACKEND: z.enum(["local", "vercel-blob"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads")
});

export const env = envSchema.parse(process.env);

if (!process.env.OPENAI_API_KEY && localOpenAIKey) {
  env.OPENAI_API_KEY = localOpenAIKey;
}

const isVercelRuntime =
  process.env.NODE_ENV === "production" &&
  process.env.VERCEL === "1" &&
  process.env.NEXT_PHASE !== "phase-production-build";

if (isVercelRuntime) {
  const dbUrl = env.DATABASE_URL.trim().toLowerCase();
  if (!dbUrl || dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
    throw new Error("DATABASE_URL must be set to a reachable hosted database in production (not localhost).\nSet it in your deployment environment variables.");
  }
}
