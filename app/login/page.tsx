"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("smajumdar");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Login failed");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="shell">
      <div className="hero">
        <section className="card">
          <div className="card-inner stack">
            <div className="kicker">IIM Bangalore</div>
            <h1>Sign in to Doppel chatbot studio.</h1>
            <p>
              Sign in to access the exam workspace, upload source material, tune chatbots,
              and preview answers before submission.
            </p>
            <div className="badge">Frozen model: gpt-5-nano</div>
          </div>
        </section>

        <section className="card">
          <div className="card-inner stack">
            <h2>Login</h2>
            <form className="stack" onSubmit={handleSubmit}>
              <div>
                <div className="label">Username</div>
                <input value={username} onChange={(event) => setUsername(event.target.value)} type="text" placeholder="smajumdar" required />
              </div>
              <div>
                <div className="label">Password</div>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
              </div>
              {error ? <div className="error">{error}</div> : null}
              {message ? <div className="success">{message}</div> : null}
              <button type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <div className="notice">Use username <strong>smajumdar</strong> for admin access. Other users sign in with username only.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
