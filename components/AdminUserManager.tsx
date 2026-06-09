"use client";

import { FormEvent, useMemo, useState } from "react";

type ManagedUser = {
  id: string;
  email: string;
  role: "STUDENT" | "GRADER" | "ADMIN";
  createdAt: string;
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
      </div>
    </section>
  );
}
