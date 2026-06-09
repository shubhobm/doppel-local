"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BotSummary = {
  id: string;
  status: string;
  name: string;
  isDemo: boolean;
  updatedAt: string;
};

type Props = {
  bots: BotSummary[];
  activeBotId: string;
};

export function BotDashboardTable({ bots, activeBotId }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deletingBotId, setDeletingBotId] = useState("");
  const [error, setError] = useState("");

  function goToBot(botId: string) {
    router.push(`/workspace?bot=${botId}`);
    router.refresh();
  }

  async function createBot() {
    setCreating(true);
    setError("");

    const response = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Chatbot ${bots.length + 1}` })
    });

    const payload = await response.json();
    setCreating(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not create chatbot");
      return;
    }

    const botId = payload?.bot?.id;
    if (typeof botId === "string" && botId) {
      goToBot(botId);
      return;
    }

    router.refresh();
  }

  async function deleteBot(botId: string) {
    const confirmed = window.confirm("Delete this chatbot? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setDeletingBotId(botId);
    setError("");
    const response = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    setDeletingBotId("");

    if (!response.ok) {
      setError(payload.error ?? "Could not delete chatbot");
      return;
    }

    router.refresh();
  }

  return (
    <section className="card">
      <div className="card-inner stack">
        <div className="row">
          <div>
            <div className="kicker">Dashboard</div>
            <h2>Doppel chatbots</h2>
          </div>
          <button onClick={createBot} disabled={creating}>
            {creating ? "Creating..." : "New chatbot"}
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="table-wrap">
          <table className="bots-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Last updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr
                  key={bot.id}
                  className={`bots-row ${bot.id === activeBotId ? "active" : ""}`}
                  onClick={() => goToBot(bot.id)}
                >
                  <td>{bot.name}</td>
                  <td>
                    <span className={`status-pill ${bot.status === "SUBMITTED" ? "submitted" : "draft"}`}>
                      {bot.status}
                    </span>
                  </td>
                  <td>{new Date(bot.updatedAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      disabled={deletingBotId === bot.id || bot.isDemo}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteBot(bot.id);
                      }}
                    >
                      {bot.isDemo ? "Protected" : deletingBotId === bot.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
