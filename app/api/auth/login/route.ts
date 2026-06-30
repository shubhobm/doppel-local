import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { comparePassword, hashPassword, sessionCookieOptions, signSessionToken } from "@/lib/auth";
import { SESSION_COOKIE, STATIC_PASSWORD, STATIC_USERNAME } from "@/lib/limits";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter valid login credentials." }, { status: 400 });
  }

  const normalizedUsername = parsed.data.username.trim().toLowerCase();
  if (!normalizedUsername || normalizedUsername.includes("@")) {
    return NextResponse.json({ error: "Use username only." }, { status: 400 });
  }

  if (normalizedUsername === STATIC_USERNAME) {
    const user = await db.user.upsert({
      where: { email: STATIC_USERNAME },
      update: { role: "STUDENT" },
      create: { email: STATIC_USERNAME, role: "STUDENT" }
    });

    let authenticated = false;
    if (user.passwordHash) {
      authenticated = await comparePassword(parsed.data.password, user.passwordHash);
    } else if (parsed.data.password === STATIC_PASSWORD) {
      authenticated = true;
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(STATIC_PASSWORD) }
      });
    }

    if (!authenticated) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const sessionToken = await signSessionToken({
      userId: user.id,
      email: user.email,
      role: "STUDENT"
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return response;
  }

  return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
}
