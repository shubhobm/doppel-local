"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";

type DocumentRecord = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  chunkCount: number;
};

type BotRecord = {
  id: string;
  name: string;
  isDemo: boolean;
  status: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  configVersion: number;
  submittedAt: string | null;
  documents: DocumentRecord[];
};

type Props = {
  bots: BotRecord[];
  activeBotId: string;
  totalBytes: number;
  uploadsEnabled: boolean;
};

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
};

export function StudentWorkspace({ bots, activeBotId, totalBytes, uploadsEnabled }: Props) {
  const router = useRouter();
  const [allBots, setAllBots] = useState(bots);
  const [currentBotId, setCurrentBotId] = useState(activeBotId);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [botName, setBotName] = useState("");
  const [temperature, setTemperature] = useState("0.2");
  const [topP, setTopP] = useState("1");
  const [topK, setTopK] = useState("20");
  const [maxOutputTokens, setMaxOutputTokens] = useState("512");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState("preview");

  const currentBot = useMemo(
    () => allBots.find((bot) => bot.id === currentBotId) ?? allBots[0],
    [allBots, currentBotId]
  );

  const documents = currentBot?.documents ?? [];

  useEffect(() => {
    setAllBots(bots);
  }, [bots]);

  useEffect(() => {
    setCurrentBotId(activeBotId);
  }, [activeBotId]);

  useEffect(() => {
    const stored = window.localStorage.getItem(`bot-session-${currentBotId}`);
    if (stored) {
      setSessionKey(stored);
      return;
    }

    const nextSession = crypto.randomUUID();
    window.localStorage.setItem(`bot-session-${currentBotId}`, nextSession);
    setSessionKey(nextSession);
  }, [currentBotId]);

  useEffect(() => {
    if (!currentBot) {
      return;
    }

    setSystemPrompt(currentBot.systemPrompt);
    setBotName(currentBot.name);
    setTemperature(String(currentBot.temperature));
    setTopP(String(currentBot.topP));
    setTopK(String(currentBot.topK));
    setMaxOutputTokens(String(currentBot.maxOutputTokens));
    setChat([]);
    setMessage("");
    setError("");
  }, [currentBot]);

  const remainingBytes = useMemo(() => Math.max(0, 100 * 1024 * 1024 - totalBytes), [totalBytes]);

  async function refreshCurrentBot(botId: string) {
    const response = await fetch(`/api/bots/${botId}?ts=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const bot = payload.bot as BotRecord;
    setAllBots((existing) => existing.map((item) => (item.id === bot.id ? bot : item)));
    setCurrentBotId(bot.id);
  }

  async function saveBot() {
    if (!currentBot) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    const normalizedBotName = botName.trim();
    if (!normalizedBotName) {
      setLoading(false);
      setError("Chatbot name cannot be empty.");
      return;
    }

    const response = await fetch(`/api/bots/${currentBot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: normalizedBotName,
        systemPrompt,
        temperature: Number(temperature),
        topP: Number(topP),
        topK: Number(topK),
        maxOutputTokens: Number(maxOutputTokens)
      })
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save bot settings");
      return;
    }
    setAllBots((existing) => existing.map((bot) => (bot.id === currentBot.id ? { ...bot, ...payload.bot } : bot)));
    setMessage("Settings saved.");
    await refreshCurrentBot(currentBot.id);
    router.refresh();
  }

  async function toggleSubmission() {
    if (!currentBot) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    const action = currentBot.status === "SUBMITTED" ? "revert" : "submit";
    const response = await fetch(`/api/bots/${currentBot.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not update submission status");
      return;
    }
    setAllBots((existing) => existing.map((bot) => (bot.id === currentBot.id ? { ...bot, ...payload.bot } : bot)));
    setMessage(action === "submit" ? "Bot submitted for grading." : "Submission reverted to draft.");
    await refreshCurrentBot(currentBot.id);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!currentBot) {
      return;
    }

    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("botId", currentBot.id);
    files.forEach((file) => formData.append("files", file));

    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    setUploading(false);

    if (!response.ok) {
      setError(payload.error ?? "Upload failed");
      return;
    }

    const uploadedDocs = Array.isArray(payload.documents) ? (payload.documents as DocumentRecord[]) : [];
    if (uploadedDocs.length) {
      setAllBots((existing) =>
        existing.map((bot) => {
          if (bot.id !== currentBot.id) {
            return bot;
          }

          const byId = new Map(bot.documents.map((doc) => [doc.id, doc]));
          for (const doc of uploadedDocs) {
            byId.set(doc.id, doc);
          }

          return {
            ...bot,
            documents: Array.from(byId.values())
          };
        })
      );
    }

    setMessage("Source material uploaded.");
    await refreshCurrentBot(currentBot.id);
    router.refresh();
  }

  async function sendQuestion() {
    if (!currentBot || !query.trim() || chatLoading) {
      return;
    }
    setChatLoading(true);
    setError("");
    const nextChat = [...chat, { role: "user" as const, content: query.trim() }];
    setChat(nextChat);
    const currentQuery = query.trim();
    setQuery("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: currentBot.id, sessionKey, question: currentQuery })
    });
    const payload = await response.json();
    setChatLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Chat failed");
      return;
    }

    setChat((existing) => [...existing, { role: "assistant", content: payload.answer }]);
  }

  if (!currentBot) {
    return null;
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-inner stack">
          <div className="row">
            <div>
              <div className="kicker">Workspace</div>
              <h2>Student chatbot configuration</h2>
            </div>
            <div className="badge">Config v{currentBot.configVersion}</div>
            <div className="badge">Model: gpt-5-nano</div>
          </div>
          {message ? <div className="success">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}
        </div>
      </section>

      <div className="workspace-columns">
        <div className="stack workspace-side">
          <section className="card">
            <div className="card-inner stack">
              <h3>LLM parameters</h3>
              <p className="small"><em>Click Save Settings nelow to reflect parameter changes in the right pane.</em></p>
              <div>
                <div className="label">Chatbot name</div>
                <input value={botName} onChange={(event) => setBotName(event.target.value)} maxLength={120} disabled={currentBot.status === "SUBMITTED"} />
              </div>
              <div>
                <div className="label">System prompt</div>
                <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} disabled={currentBot.status === "SUBMITTED"} />
              </div>
              <div className="panel-grid">
                <div>
                  <div className="label">Temperature</div>
                  <input value={temperature} onChange={(event) => setTemperature(event.target.value)} type="number" min="0" max="2" step="0.1" disabled={currentBot.status === "SUBMITTED"} />
                </div>
                <div>
                  <div className="label">Top-p</div>
                  <input value={topP} onChange={(event) => setTopP(event.target.value)} type="number" min="0" max="1" step="0.05" disabled={currentBot.status === "SUBMITTED"} />
                </div>
                <div>
                  <div className="label">Top-k</div>
                  <input value={topK} onChange={(event) => setTopK(event.target.value)} type="number" min="1" max="100" step="1" disabled={currentBot.status === "SUBMITTED"} />
                </div>
                <div>
                  <div className="label">Max output tokens</div>
                  <input value={maxOutputTokens} onChange={(event) => setMaxOutputTokens(event.target.value)} type="number" min="32" max="4096" step="32" disabled={currentBot.status === "SUBMITTED"} />
                </div>
              </div>
              <div className="row">
                <button onClick={saveBot} disabled={loading || currentBot.status === "SUBMITTED"}>Save settings</button>
                <button className="secondary" onClick={toggleSubmission} disabled={loading || !uploadsEnabled}>
                  {currentBot.status === "SUBMITTED" ? "Revert submission" : "Submit for grading"}
                </button>
              </div>
            </div>
          </section>

          <section className={uploadsEnabled ? "card" : "card disabled-panel"}>
            <div className="card-inner stack">
              <h3>Source material</h3>
              <div className="notice">
                Upload limit remaining: {(remainingBytes / (1024 * 1024)).toFixed(1)} MB. Files used: {documents.length}/100.
              </div>
              <p>
                {uploadsEnabled
                  ? "Upload PDFs, text files, DOCX, or markdown files. The system indexes them automatically."
                  : "Source uploads are disabled. This chatbot currently runs in system-prompt-only mode."}
              </p>
              <input type="file" multiple onChange={handleUpload} disabled={!uploadsEnabled || uploading || currentBot.status === "SUBMITTED"} />
              <div className="file-list">
                {documents.map((doc) => (
                  <div className="file-item" key={doc.id}>
                    <div className="file-meta">
                      <div className="file-name" title={doc.filename}>{doc.filename}</div>
                      <div className="small mono">{doc.mimeType}</div>
                    </div>
                    <div className="small">{(doc.sizeBytes / 1024).toFixed(1)} KB</div>
                  </div>
                ))}
                {!documents.length ? <p>No files uploaded yet.</p> : null}
              </div>
            </div>
          </section>
        </div>

        <section className="card chat workspace-main">
          <div className="card-inner stack">
          <div className="row">
            <div>
              <div className="kicker">Preview</div>
              <h3>Multi-turn Q&A</h3>
            </div>
            <div className="badge">Session: {sessionKey || "initializing..."}</div>
            <div className="badge">Status: {currentBot.status}</div>
          </div>
          <div className="chat-log">
            {chat.length ? chat.map((entry, index) => (
              <div className={`bubble ${entry.role}`} key={`${entry.role}-${index}`}>
                <div className="role">{entry.role}</div>
                <div>{entry.content}</div>
              </div>
            )) : <p>Ask the bot a question to preview how the chatbot will answer.</p>}
            {chatLoading ? (
              <div className="bubble assistant typing-bubble" aria-live="polite" aria-label="Assistant is typing">
                <div className="role">assistant</div>
                <div className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
          </div>
          <div className="divider" />
          <div className="row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask a question..." onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion();
              }
            }} disabled={chatLoading} />
            <button onClick={sendQuestion} disabled={chatLoading}>{chatLoading ? "Thinking..." : "Send"}</button>
          </div>
        </div>
        </section>
      </div>
    </div>
  );
}
