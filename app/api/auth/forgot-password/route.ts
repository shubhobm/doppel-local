import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { comparePassword, hashPassword } from "@/lib/auth";
import { STATIC_PASSWORD } from "@/lib/limits";
import { getSessionUserFromRequest } from "@/lib/request";
import { db } from "@/lib/db";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Current password and a valid new password are required." }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: "New password must be different from current password." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let currentPasswordValid = false;
  if (user.passwordHash) {
    currentPasswordValid = await comparePassword(parsed.data.currentPassword, user.passwordHash);
  } else {
    currentPasswordValid = parsed.data.currentPassword === STATIC_PASSWORD;
  }

  if (!currentPasswordValid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash }
  });

  return NextResponse.json({ ok: true, message: "Password updated." });
}
