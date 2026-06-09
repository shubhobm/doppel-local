import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionFromCookies } from "@/lib/auth";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import { ensureDemoBotForUser } from "@/lib/demoBot";
import { env } from "@/lib/env";

type WorkspacePageProps = {
  searchParams?: Promise<{ bot?: string }>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    redirect("/login");
  }

  let bots = await db.studentBot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      documents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!bots.length) {
    const created = await ensureDemoBotForUser(user.id);
    bots = [created];
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  if (!resolvedSearchParams.bot) {
    redirect(`/workspace?bot=${bots[0].id}`);
  }

  const activeBot = bots.find((candidate) => candidate.id === resolvedSearchParams.bot);
  if (!activeBot) {
    redirect("/dashboard");
  }

  const totalBytes = activeBot.documents.reduce((sum, doc) => sum + doc.sizeBytes, 0);

  return (
    <main className="shell stack">
      <div className="row">
        <a className="text-link" href="/dashboard">Back to dashboard</a>
      </div>
      <StudentWorkspace
        bots={bots.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          isDemo: candidate.isDemo || candidate.name === "Seeded Demo Chatbot" || candidate.name === "Demo Chatbot",
          status: candidate.status,
          systemPrompt: candidate.systemPrompt,
          temperature: candidate.temperature,
          topP: candidate.topP,
          topK: candidate.topK,
          maxOutputTokens: candidate.maxOutputTokens,
          configVersion: candidate.configVersion,
          submittedAt: candidate.submittedAt?.toISOString() ?? null,
          documents: candidate.documents.map((document) => ({
            id: document.id,
            filename: document.filename,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            status: document.status,
            chunkCount: document.chunkCount
          }))
        }))}
        activeBotId={activeBot.id}
          uploadsEnabled={env.UPLOADS_ENABLED}
        totalBytes={totalBytes}
      />
    </main>
  );
}
