import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { comparePassword, hashPassword, sessionCookieOptions, signSessionToken } from "@/lib/auth";
import { ALLOWED_EMAIL_DOMAIN, SESSION_COOKIE, STATIC_PASSWORD, STATIC_USERNAME } from "@/lib/limits";

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

  const adminEmail = STATIC_USERNAME;
  const legacyAdminEmail = `${STATIC_USERNAME}@${ALLOWED_EMAIL_DOMAIN}`;

  if (normalizedUsername === STATIC_USERNAME) {
    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const legacyAdmin = await db.user.findUnique({ where: { email: legacyAdminEmail } });
      if (legacyAdmin) {
        await db.user.update({
          where: { id: legacyAdmin.id },
          data: { email: adminEmail, role: "ADMIN" }
        });
      }
    }

    const user = await db.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN" },
      create: { email: adminEmail, role: "ADMIN" }
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
      role: "ADMIN"
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return response;
  }

  const email = normalizedUsername;
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const authenticated = await comparePassword(parsed.data.password, user.passwordHash);

  if (!authenticated) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const sessionToken = await signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return response;
}
