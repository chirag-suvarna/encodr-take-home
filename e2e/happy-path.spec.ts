import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("user can create and complete an encode", async ({ page }) => {
  await signIn(page);

  const file = `happy-${Date.now()}.mp4`;
  await page.getByLabel(/source url/i).fill(`https://cdn.example.com/videos/${file}`);
  await page.getByRole("button", { name: /create job/i }).click();

  const row = page.getByRole("link", { name: new RegExp(file) });
  await expect(row).toBeVisible();
  await row.click();

  await page.getByRole("button", { name: /start encode/i }).click();
  await expect(page.getByText("%").first()).toBeVisible();

  await expect(page.getByText("COMPLETED").first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Renditions" })).toBeVisible();
  await expect(page.getByText(/1080p/i)).toBeVisible();
});
