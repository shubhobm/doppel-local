import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookieOptions, signSessionToken } from "@/lib/auth";
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

  if (parsed.data.username !== STATIC_USERNAME || parsed.data.password !== STATIC_PASSWORD) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const user = await db.user.upsert({
    where: { email: `${STATIC_USERNAME}@iimb.ac.in` },
    update: { role: "STUDENT" },
    create: { email: `${STATIC_USERNAME}@iimb.ac.in`, role: "STUDENT" }
  });

  const sessionToken = await signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return response;
}
