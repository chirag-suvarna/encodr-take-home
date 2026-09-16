import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page) {
  await page.goto("/signin");
  const email = page.getByLabel("Email");
  await email.clear();
  await email.fill("demo@encodr.dev");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/jobs/, { timeout: 15_000 });
}
