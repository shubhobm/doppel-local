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

  return NextResponse.json({ error: "User import is disabled in the local student build." }, { status: 403 });
}
