import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionFromCookies } from "@/lib/auth";
import { BotDashboardTable } from "@/components/BotDashboardTable";
import { LogoutButton } from "@/components/LogoutButton";
import { ensureDemoBotForUser } from "@/lib/demoBot";
import { AdminUserManager } from "@/components/AdminUserManager";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; owner?: string }> }) {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;

  const user = await db.user.findUnique({
    where: { id: session.userId }
  });

  if (!user) {
    redirect("/login");
  }

  const activeTab = resolvedSearchParams.tab === "users" ? "users" : "bots";
  if (activeTab === "users" && user.role !== "ADMIN") {
    redirect("/dashboard?tab=bots");
  }
  const displayUsername = user.email.split("@")[0] || user.email;

  const managedUsers =
    user.role === "ADMIN"
      ? await db.user.findMany({
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true
          }
        })
      : [];

  const selectedOwnerId =
    user.role === "ADMIN" && resolvedSearchParams.owner && managedUsers.some((candidate) => candidate.id === resolvedSearchParams.owner)
      ? resolvedSearchParams.owner
      : user.id;

  let bots = await db.studentBot.findMany({
    where: { userId: selectedOwnerId },
    orderBy: { createdAt: "asc" },
    include: {
      documents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!bots.length && selectedOwnerId === user.id) {
    const created = await ensureDemoBotForUser(user.id);
    bots = [created];
  }

  const canManageSelectedOwner = selectedOwnerId === user.id;

  return (
    <main className="shell stack">
      <section className="card">
        <div className="card-inner stack">
          <div className="row">
            <div>
              {/* <div className="kicker">IIM Bangalore</div> */}
              <h1>Welcome back, {displayUsername}.</h1>
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
          <div className="tab-row">
            <a className={`tab-link ${activeTab === "bots" ? "active" : ""}`} href="/dashboard?tab=bots">Chatbots</a>
            {user.role === "ADMIN" ? (
              <a className={`tab-link ${activeTab === "users" ? "active" : ""}`} href="/dashboard?tab=users">Users</a>
            ) : null}
          </div>
        </div>
      </section>
      {activeTab === "bots" ? (
        <BotDashboardTable
          bots={bots.map((candidate) => ({
            id: candidate.id,
            status: candidate.status,
            name: candidate.name,
            isDemo: candidate.isDemo || candidate.name === "Seeded Demo Chatbot" || candidate.name === "Demo Chatbot",
            updatedAt: candidate.updatedAt.toISOString()
          }))}
          activeBotId=""
          showOwnerSelector={user.role === "ADMIN"}
          selectedOwnerId={selectedOwnerId}
          ownerOptions={
            user.role === "ADMIN"
              ? managedUsers.map((candidate) => ({
                  id: candidate.id,
                  username: candidate.email,
                  role: candidate.role
                }))
              : []
          }
          canManageBots={canManageSelectedOwner}
          includeOwnerInBotLinks={!canManageSelectedOwner}
        />
      ) : null}
      {activeTab === "users" && user.role === "ADMIN" ? (
        <AdminUserManager
          currentUserId={user.id}
          users={managedUsers.map((candidate) => ({
            id: candidate.id,
            email: candidate.email,
            role: candidate.role,
            createdAt: candidate.createdAt.toISOString()
          }))}
        />
      ) : null}
    </main>
  );
}
