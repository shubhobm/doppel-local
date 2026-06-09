import crypto from "crypto";
import { env } from "./env";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function buildVerificationLink(token: string) {
  return `${env.APP_URL}/verify?token=${encodeURIComponent(token)}`;
}
