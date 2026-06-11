import assert from "node:assert/strict";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

function mustEnv(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
}

async function request(path, init = {}, cookie = "") {
  const headers = new Headers(init.headers || {});
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { response, json };
}

function parseCookie(setCookieHeader) {
  const first = setCookieHeader?.split(",")[0] ?? "";
  return first.split(";")[0];
}

async function main() {
  const username = process.env.TEST_USERNAME || "smajumdar";
  const password = process.env.TEST_PASSWORD || "admin1234";

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  assert.equal(login.response.status, 200, `login failed: ${JSON.stringify(login.json)}`);
  const cookie = parseCookie(login.response.headers.get("set-cookie"));
  mustEnv(cookie, "session cookie");

  const createBot = await request(
    "/api/bots",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Upload Test ${Date.now()}` })
    },
    cookie
  );
  assert.equal(createBot.response.status, 200, `create bot failed: ${JSON.stringify(createBot.json)}`);
  const botId = createBot.json?.bot?.id;
  mustEnv(botId, "bot id");

  const files = [
    new File(["First file content for upload test"], "file-a.txt", { type: "text/plain" }),
    new File(["Second file content for upload test"], "file-b.txt", { type: "text/plain" })
  ];

  for (const file of files) {
    const fd = new FormData();
    fd.append("botId", botId);
    fd.append("files", file);

    const upload = await request(
      "/api/documents/upload",
      {
        method: "POST",
        body: fd
      },
      cookie
    );

    assert.equal(upload.response.status, 200, `upload failed for ${file.name}: ${JSON.stringify(upload.json)}`);
    assert.equal(upload.json?.uploaded, 1, `unexpected uploaded count for ${file.name}: ${JSON.stringify(upload.json)}`);
  }

  const saveSettings = await request(
    `/api/bots/${botId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Upload Test Bot",
        systemPrompt: "Use source content if available.",
        temperature: 0.4,
        topP: 0.9,
        topK: 25,
        maxOutputTokens: 640
      })
    },
    cookie
  );
  assert.equal(saveSettings.response.status, 200, `save settings failed: ${JSON.stringify(saveSettings.json)}`);

  const readBot = await request(`/api/bots/${botId}`, { method: "GET" }, cookie);
  assert.equal(readBot.response.status, 200, `read bot failed: ${JSON.stringify(readBot.json)}`);
  const docs = readBot.json?.bot?.documents || [];
  assert.equal(docs.length, 2, `expected 2 uploaded docs, got ${docs.length}`);
  assert.equal(readBot.json?.bot?.topK, 25, "topK setting did not persist");

  const chat = await request(
    "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId,
        sessionKey: `upload-test-${Date.now()}`,
        question: "What content did I upload?"
      })
    },
    cookie
  );

  assert.equal(chat.response.status, 200, `chat failed: ${JSON.stringify(chat.json)}`);
  assert.ok(typeof chat.json?.answer === "string" && chat.json.answer.length > 0, "chat answer missing");
  assert.ok(Array.isArray(chat.json?.retrievedChunks), "retrievedChunks missing");
  assert.ok(chat.json.retrievedChunks.length >= 1, "expected at least one retrieved chunk");

  console.log("E2E upload flow test passed.");
}

main().catch((error) => {
  console.error("E2E upload flow test failed.", error);
  process.exit(1);
});
