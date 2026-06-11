import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteStoredFile } from "@/lib/files";
import { getSessionUserFromRequest } from "@/lib/request";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const document = await db.sourceDocument.findFirst({
    where: {
      id: documentId,
      bot: {
        userId: session.user.id
      }
    },
    include: {
      bot: true
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.bot.status === "SUBMITTED") {
    return NextResponse.json({ error: "Submitted bot cannot be modified until submission is reverted." }, { status: 409 });
  }

  try {
    await deleteStoredFile(document.storagePath);
  } catch (error) {
    console.error("Failed to delete stored file", {
      documentId: document.id,
      storagePath: document.storagePath,
      backend: process.env.UPLOAD_BACKEND,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  await db.sourceDocument.delete({ where: { id: document.id } });
  return NextResponse.json({ ok: true, documentId: document.id });
}
