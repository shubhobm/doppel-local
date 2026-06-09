import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getSessionUserFromRequest } from "@/lib/request";

const createUserSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128),
  role: z.enum(["STUDENT", "GRADER", "ADMIN"]).default("STUDENT")
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required." }, { status: 403 });
}

function normalizeEmailFromUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("@")) {
    return "";
  }

  return normalized;
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

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid username, password, and role." }, { status: 400 });
  }

  const { username, password, role } = parsed.data;
  const email = normalizeEmailFromUsername(username);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid username only (no @)." }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email,
      role,
      passwordHash: await hashPassword(password)
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true
    }
  });

  return NextResponse.json({ user }, { status: 201 });
}
