import { z } from "zod";
import fs from "fs";
import path from "path";

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

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/midterm"),
  AUTH_SECRET: z.string().default("development-secret-development-secret-development-secret"),
  APP_URL: z.string().default("http://localhost:3000"),
  GRADER_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  UPLOAD_DIR: z.string().default("./uploads")
});

export const env = envSchema.parse(process.env);

if (!process.env.OPENAI_API_KEY && localOpenAIKey) {
  env.OPENAI_API_KEY = localOpenAIKey;
}
