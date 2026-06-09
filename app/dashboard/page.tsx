import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionFromCookies } from "@/lib/auth";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import { BotDashboardTable } from "@/components/BotDashboardTable";

type DashboardPageProps = {
  searchParams?: Promise<{ bot?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId }
  });

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
    const created = await db.studentBot.create({
      data: {
        userId: user.id
      },
      include: {
        documents: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
    bots = [created];
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeBotId = resolvedSearchParams.bot && bots.some((candidate) => candidate.id === resolvedSearchParams.bot)
    ? resolvedSearchParams.bot
    : bots[0].id;
  const activeBot = bots.find((candidate) => candidate.id === activeBotId) ?? bots[0];
  const documents = activeBot.documents;
  const totalBytes = documents.reduce((sum, doc) => sum + doc.sizeBytes, 0);

  return (
    <main className="shell stack">
      <section className="card">
        <div className="card-inner stack">
          <div className="row">
            <div>
              <div className="kicker">IIM Bangalore</div>
              <h1>Welcome back, {user.email}.</h1>
            </div>
            <div className="badge">Role: {user.role}</div>
          </div>
          <p>
            Doppel lets you manage multiple chatbots, configure prompts and parameters, upload course material, and submit each chatbot for grading.
          </p>
          <div>
            <a className="text-link" href="/forgot-password">Forgot password</a>
          </div>
        </div>
      </section>
      <BotDashboardTable
        bots={bots.map((candidate) => ({
          id: candidate.id,
          status: candidate.status,
          name: candidate.name,
          updatedAt: candidate.updatedAt.toISOString()
        }))}
        activeBotId={activeBot.id}
      />
      <StudentWorkspace
        bots={bots.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
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
        totalBytes={totalBytes}
      />
    </main>
  );
}
