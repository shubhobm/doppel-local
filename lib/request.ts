import { NextRequest } from "next/server";
import { db } from "./db";
import { SESSION_COOKIE } from "./limits";
import { verifySessionToken } from "./auth";

export async function getSessionUserFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const session = await verifySessionToken(token);
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return null;
    }
    return { session, user };
  } catch {
    return null;
  }
}
