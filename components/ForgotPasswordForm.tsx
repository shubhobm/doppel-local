"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not update password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated successfully.");
  }

  return (
    <section className="card">
      <div className="card-inner stack">
        <div className="kicker">Account security</div>
        <h1>Forgot password</h1>
        <p>Change your password while you are signed in.</p>
        <form className="stack" onSubmit={handleSubmit}>
          <div>
            <div className="label">Current password</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <div className="label">New password</div>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <div className="label">Confirm new password</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          {error ? <div className="error">{error}</div> : null}
          {message ? <div className="success">{message}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>
          <a className="text-link" href="/dashboard">Back to dashboard</a>
        </form>
      </div>
    </section>
  );
}
