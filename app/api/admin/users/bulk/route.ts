import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getSessionUserFromRequest } from "@/lib/request";
import { parseCsv, usernameFromEmail } from "@/lib/users";

const bodySchema = z.object({
  csv: z.string().min(1)
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return unauthorized();
  }

  if (session.user.role !== "ADMIN") {
    return forbidden();
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });
  }

  const rows = parseCsv(parsed.data.csv);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV must contain a header row and at least one data row." }, { status: 400 });
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const emailColumn = header.indexOf("email id");
  if (emailColumn === -1) {
    return NextResponse.json({ error: "CSV must include an 'Email ID' column." }, { status: 400 });
  }

  const created: { id: string; email: string; role: string; createdAt: Date }[] = [];
  const skipped: string[] = [];
  const invalid: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rawEmail = (rows[i][emailColumn] ?? "").trim();
    if (!rawEmail) {
      continue;
    }

    const username = usernameFromEmail(rawEmail);
    if (!username) {
      invalid.push(rawEmail);
      continue;
    }

    const existing = await db.user.findUnique({ where: { email: username } });
    if (existing) {
      skipped.push(username);
      continue;
    }

    const user = await db.user.create({
      data: {
        email: username,
        role: "STUDENT",
        passwordHash: await hashPassword(username)
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    created.push(user);
  }

  return NextResponse.json({ created, skipped, invalid });
}
