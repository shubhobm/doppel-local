"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

type ManagedUser = {
  id: string;
  email: string;
  role: "STUDENT" | "GRADER" | "ADMIN";
  createdAt: string;
};

type BulkResult = {
  created: ManagedUser[];
  skipped: string[];
  invalid: string[];
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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleBulkUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBulkLoading(true);
    setBulkError("");
    setBulkResult(null);
    setError("");
    setSuccess("");

    try {
      const csv = await file.text();
      const response = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBulkError(payload.error ?? "Could not process CSV.");
        return;
      }

      const result = payload as BulkResult;
      setBulkResult(result);
      if (result.created.length > 0) {
        setUsers((previous) => [...previous, ...result.created]);
      }
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

        <div className="stack">
          <div>
            <div className="label">Bulk add from CSV</div>
            <p className="small">
              Upload a CSV with an <span className="mono">Email ID</span> column. A user is created for
              each row with the username taken from the part before the @ in the email address, and the
              password set to that same username.
            </p>
          </div>
          <div className="row">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => void handleBulkUpload(event)} disabled={bulkLoading} />
          </div>

          {bulkLoading ? <p className="small">Processing CSV...</p> : null}
          {bulkError ? <div className="error">{bulkError}</div> : null}
          {bulkResult ? (
            <div className="success">
              <p>Created {bulkResult.created.length} user(s).</p>
              {bulkResult.skipped.length > 0 ? (
                <p className="small">Skipped (already exist): {bulkResult.skipped.join(", ")}</p>
              ) : null}
              {bulkResult.invalid.length > 0 ? (
                <p className="small">Skipped (invalid email): {bulkResult.invalid.join(", ")}</p>
              ) : null}
            </div>
          ) : null}
        </div>

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
