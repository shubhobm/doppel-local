"use client";

import { FormEvent, useMemo, useState } from "react";

type ManagedUser = {
  id: string;
  email: string;
  role: "STUDENT" | "GRADER" | "ADMIN";
  createdAt: string;
};

type ManagedDocument = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  status: string;
};

type ManagedBot = {
  id: string;
  name: string;
  status: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  configVersion: number;
  submittedAt: string | null;
  documents: ManagedDocument[];
};

type Props = {
  currentUserId: string;
  users: ManagedUser[];
};

export function AdminUserManager({ currentUserId, users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "GRADER" | "ADMIN">("STUDENT");
  const [loading, setLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inspectUsername, setInspectUsername] = useState("");
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectedUser, setInspectedUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [inspectedBots, setInspectedBots] = useState<ManagedBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [adminQuestion, setAdminQuestion] = useState("");
  const [adminQueryLoading, setAdminQueryLoading] = useState(false);
  const [adminAnswer, setAdminAnswer] = useState("");
  const [adminQueryError, setAdminQueryError] = useState("");

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role })
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not create user.");
      return;
    }

    const createdUser = payload?.user;
    if (!createdUser?.id) {
      setError("Unexpected response from server.");
      return;
    }

    setUsers((previous) => [
      ...previous,
      {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
        createdAt: createdUser.createdAt
      }
    ]);
    setUsername("");
    setPassword("");
    setRole("STUDENT");
    setSuccess("User created.");
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm("Delete this user and all associated bots? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setDeletingUserId(userId);
    setError("");
    setSuccess("");

    const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    setDeletingUserId("");

    if (!response.ok) {
      setError(payload.error ?? "Could not delete user.");
      return;
    }

    setUsers((previous) => previous.filter((candidate) => candidate.id !== userId));
    setSuccess("User deleted.");

    if (inspectedUser?.id === userId) {
      setInspectedUser(null);
      setInspectedBots([]);
      setSelectedBotId("");
      setAdminAnswer("");
      setAdminQuestion("");
    }
  }

  async function inspectUserBots() {
    const normalized = inspectUsername.trim().toLowerCase();
    if (!normalized) {
      setAdminQueryError("Select a user first.");
      return;
    }

    setInspectLoading(true);
    setAdminQueryError("");
    setAdminAnswer("");

    const response = await fetch("/api/admin/bots/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalized })
    });
    const payload = await response.json().catch(() => ({}));
    setInspectLoading(false);

    if (!response.ok) {
      setAdminQueryError(payload.error ?? "Could not load bot inventory.");
      return;
    }

    setInspectedUser(payload.user ?? null);
    const nextBots = Array.isArray(payload.bots) ? (payload.bots as ManagedBot[]) : [];
    setInspectedBots(nextBots);
    setSelectedBotId(nextBots[0]?.id ?? "");
  }

  async function askBotAsAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBotId || !adminQuestion.trim()) {
      setAdminQueryError("Select a bot and enter a question.");
      return;
    }

    setAdminQueryLoading(true);
    setAdminQueryError("");
    setAdminAnswer("");

    const response = await fetch("/api/admin/bots/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: selectedBotId,
        question: adminQuestion.trim(),
        sessionKey: `admin-ui-${selectedBotId}`
      })
    });
    const payload = await response.json().catch(() => ({}));
    setAdminQueryLoading(false);

    if (!response.ok) {
      setAdminQueryError(payload.error ?? "Admin bot query failed.");
      return;
    }

    setAdminAnswer(typeof payload.answer === "string" ? payload.answer : "No answer returned.");
  }

  return (
    <section className="card">
      <div className="card-inner stack">
        <div>
          <div className="kicker">Admin</div>
          <h2>User management</h2>
          <p>Create or remove users for the exam workspace.</p>
        </div>

        <form className="stack" onSubmit={handleCreateUser}>
          <div className="admin-user-form-grid">
            <div>
              <div className="label">Username</div>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="student1"
                required
              />
            </div>
            <div>
              <div className="label">Password</div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <div className="label">Role</div>
              <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                <option value="STUDENT">STUDENT</option>
                <option value="GRADER">GRADER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? "Adding user..." : "Add user"}
            </button>
          </div>
        </form>

        <p className="small">Use username only (for example: <span className="mono">student1</span>).</p>

        {error ? <div className="error">{error}</div> : null}
        {success ? <div className="success">{success}</div> : null}

        <div className="table-wrap">
          <table className="bots-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>
                    <span className="status-pill draft">{user.role}</span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void deleteUser(user.id)}
                      disabled={deletingUserId === user.id || user.id === currentUserId}
                    >
                      {user.id === currentUserId ? "Current admin" : deletingUserId === user.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-divider" />

        <div className="stack">
          <div>
            <h3>Inspect and query any student bot</h3>
            <p className="small">Select a student, review all bot settings/files, then query any bot directly as admin.</p>
          </div>

          <div className="admin-bot-query-grid">
            <div>
              <div className="label">Student username</div>
              <select
                value={inspectUsername}
                onChange={(event) => setInspectUsername(event.target.value)}
              >
                <option value="">Select a user</option>
                {sortedUsers.map((candidate) => (
                  <option key={candidate.id} value={candidate.email}>
                    {candidate.email} ({candidate.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="row align-end">
              <button type="button" onClick={() => void inspectUserBots()} disabled={inspectLoading || !inspectUsername}>
                {inspectLoading ? "Loading bots..." : "Load user bots"}
              </button>
            </div>
          </div>

          {inspectedUser ? (
            <p className="small">
              Viewing: <span className="mono">{inspectedUser.username}</span> ({inspectedUser.role})
            </p>
          ) : null}

          {inspectedBots.length ? (
            <div className="table-wrap">
              <table className="bots-table">
                <thead>
                  <tr>
                    <th>Bot</th>
                    <th>Status</th>
                    <th>LLM parameters</th>
                    <th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectedBots.map((bot) => (
                    <tr key={bot.id}>
                      <td>
                        <div><strong>{bot.name}</strong></div>
                        <div className="small mono">{bot.id}</div>
                      </td>
                      <td>
                        <span className={`status-pill ${bot.status === "SUBMITTED" ? "submitted" : "draft"}`}>{bot.status}</span>
                      </td>
                      <td className="small mono">
                        temp={bot.temperature}, topP={bot.topP}, topK={bot.topK}, maxTokens={bot.maxOutputTokens}, cfg={bot.configVersion}
                      </td>
                      <td>
                        <div className="small">{bot.documents.length} file(s)</div>
                        <div className="small mono">{bot.documents.slice(0, 3).map((doc) => doc.filename).join(", ") || "None"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : inspectedUser ? (
            <p className="small">No bots found for this user.</p>
          ) : null}

          <form className="stack" onSubmit={askBotAsAdmin}>
            <div>
              <div className="label">Target bot</div>
              <select value={selectedBotId} onChange={(event) => setSelectedBotId(event.target.value)} disabled={!inspectedBots.length}>
                <option value="">Select a bot</option>
                {inspectedBots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} [{bot.status}] - {bot.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">Question</div>
              <textarea
                value={adminQuestion}
                onChange={(event) => setAdminQuestion(event.target.value)}
                placeholder="Ask this student's bot any question"
                rows={3}
              />
            </div>
            <div className="row">
              <button type="submit" disabled={adminQueryLoading || !selectedBotId || !adminQuestion.trim()}>
                {adminQueryLoading ? "Querying bot..." : "Query selected bot"}
              </button>
            </div>
          </form>

          {adminQueryError ? <div className="error">{adminQueryError}</div> : null}
          {adminAnswer ? (
            <div className="card-subtle stack">
              <div className="kicker">Admin response</div>
              <div>{adminAnswer}</div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
