import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  use: {
    baseURL: process.env.APP_BASE_URL || "http://localhost:3000",
    headless: true,
    locale: "en-US"
  },
  reporter: "list"
});
