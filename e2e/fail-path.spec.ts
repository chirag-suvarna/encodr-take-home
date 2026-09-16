import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("corrupt URL fails and retry starts a new run", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);

  const title = `fail-${Date.now()}`;
  await page.getByLabel(/source url/i).fill("https://cdn.example.com/videos/corrupt.mp4");
  await page.getByLabel(/title/i).fill(title);
  await page.getByRole("button", { name: /create job/i }).click();

  const row = page.getByRole("link", { name: new RegExp(title) });
  await expect(row).toBeVisible();
  await row.click();

  await page.getByRole("button", { name: /start encode/i }).click();
  await expect(page.getByText("FAILED").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/corrupt/i).first()).toBeVisible();

  const runId = page.locator("span.font-mono").first();
  const firstId = await runId.textContent();
  await page.getByRole("button", { name: /retry/i }).click();
  await expect(runId).not.toHaveText(firstId ?? "", { timeout: 10_000 });
});
