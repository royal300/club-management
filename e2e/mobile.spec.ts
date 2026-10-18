import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Cards and panels must sit fully inside the viewport (catches grid blow-outs that body overflow hides). */
async function cardsFit(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main section, main .rounded-2xl"))
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => el.className.slice(0, 60)),
  );
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("club-intro-seen", "1"));
});

test("@smoke dashboard works one-handed on a phone", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("balance-total")).toBeVisible();
  // No sideways scrolling anywhere on the page.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await cardsFit(page)).toEqual([]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "docs/screenshots/mobile-dashboard.png" });

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Transactions" })).toBeVisible();
  await page.getByRole("link", { name: "Members" }).click();
  await expect(page).toHaveURL(/\/members/);
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
});

test("@smoke recording money is comfortable on a phone", async ({ page }) => {
  await page.goto("/transactions/new?kind=INCOME");
  const amount = page.getByLabel("Amount");
  await expect(amount).toBeVisible();
  const box = await amount.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44); // thumb-sized target
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await cardsFit(page)).toEqual([]);
  await page.screenshot({ path: "docs/screenshots/mobile-record-income.png", fullPage: true });
});

test("@smoke member and transaction pages fit a phone", async ({ page }) => {
  for (const url of ["/members", "/members/1", "/transactions", "/transactions/1", "/events", "/events/1", "/reports", "/renewals"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await cardsFit(page), url).toEqual([]);
  }
});

test.describe("public story", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("@smoke the landing page reads well on a phone", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The headline letters must actually rise into place.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".hero-char")!).transform), { timeout: 8000 })
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "docs/screenshots/mobile-landing.png" });
  });
});
