import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { STATIC_USERNAME } from "@/lib/limits";
import { getSessionUserFromRequest } from "@/lib/request";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required." }, { status: 403 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return unauthorized();
  }

  if (session.user.role !== "ADMIN") {
    return forbidden();
  }

  const { userId } = await params;
  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (targetUser.id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 409 });
  }

  if (targetUser.email === STATIC_USERNAME) {
    return NextResponse.json({ error: "Protected admin account cannot be deleted." }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    await tx.queryLog.deleteMany({ where: { userId: targetUser.id } });
    await tx.verificationToken.deleteMany({ where: { userId: targetUser.id } });
    await tx.studentBot.deleteMany({ where: { userId: targetUser.id } });
    await tx.user.delete({ where: { id: targetUser.id } });
  });

  return NextResponse.json({ ok: true });
}
