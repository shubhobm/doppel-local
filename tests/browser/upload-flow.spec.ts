import path from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { expect, test } from "@playwright/test";

const USERNAME = process.env.TEST_USERNAME || "test";
const PASSWORD = process.env.TEST_PASSWORD || "test1234";
const FIXTURES_DIR = path.join(process.cwd(), "tests", "browser", "_fixtures");

function writeFixture(name: string, content: string) {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const filePath = path.join(FIXTURES_DIR, name);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

test.afterAll(() => {
  try {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
});

test("multi-file upload: button shows Uploading, returns to Upload selected, all files listed", async ({ page }) => {
  const fileA = writeFixture("browser-upload-a.txt", "First browser upload test file content.");
  const fileB = writeFixture("browser-upload-b.txt", "Second browser upload test file content.");

  // Login
  await page.goto("/login");
  await page.fill('input[type="text"]', USERNAME);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**");

  // Create a fresh bot
  await page.click("button:has-text('New chatbot')");
  await page.waitForURL("**/workspace**");

  // Select two files
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([fileA, fileB]);
  await expect(page.locator("text=2 file(s) selected")).toBeVisible();

  // Upload selected — button must become "Uploading..."
  await page.click("button:has-text('Upload selected')");
  await expect(page.locator("button:has-text('Uploading...')")).toBeVisible({ timeout: 5000 });

  // Wait for upload to complete — button must return to "Upload selected"
  await expect(page.locator("button:has-text('Upload selected')")).toBeVisible({ timeout: 60000 });

  // Both file names must appear in the file list
  await expect(page.locator("text=browser-upload-a.txt")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("text=browser-upload-b.txt")).toBeVisible({ timeout: 10000 });

  // Save settings must be enabled after upload
  const saveBtn = page.locator("button:has-text('Save settings')");
  await expect(saveBtn).toBeEnabled({ timeout: 5000 });

  // Save settings
  await saveBtn.click();
  await expect(page.locator("text=Settings saved.")).toBeVisible({ timeout: 10000 });
});
