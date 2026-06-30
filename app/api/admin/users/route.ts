import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/request";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required." }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return unauthorized();
  }

  if (session.user.role !== "ADMIN") {
    return forbidden();
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true
    }
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return unauthorized();
  }

  if (session.user.role !== "ADMIN") {
    return forbidden();
  }

  return NextResponse.json({ error: "User creation is disabled in the local student build." }, { status: 403 });
}
