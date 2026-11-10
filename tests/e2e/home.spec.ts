import { expect, test } from "@playwright/test";

test("public homepage explains nationwide legal discovery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /When the law matters/i })).toBeVisible();
  await expect(page.getByText("Western Cape", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Find a lawyer/i }).first()).toBeVisible();
});

test("registration page shows account requirements", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /Create your account/i })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "12");
});
