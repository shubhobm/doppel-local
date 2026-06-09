import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionFromCookies } from "@/lib/auth";
import { BotDashboardTable } from "@/components/BotDashboardTable";
import { LogoutButton } from "@/components/LogoutButton";
import { ensureDemoBotForUser } from "@/lib/demoBot";

export default async function DashboardPage() {
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
    const created = await ensureDemoBotForUser(user.id);
    bots = [created];
  }

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
          <div className="row">
            <a className="text-link" href="/change-password">Change password</a>
            <LogoutButton className="secondary" />
          </div>
        </div>
      </section>
      <BotDashboardTable
        bots={bots.map((candidate) => ({
          id: candidate.id,
          status: candidate.status,
          name: candidate.name,
          isDemo: candidate.isDemo || candidate.name === "Seeded Demo Chatbot" || candidate.name === "Demo Chatbot",
          updatedAt: candidate.updatedAt.toISOString()
        }))}
        activeBotId=""
      />
    </main>
  );
}
