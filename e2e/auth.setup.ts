import { expect, test as setup } from "@playwright/test";
import { E2E } from "./env";

const roles = E2E.live ? (["admin"] as const) : (["admin", "treasurer", "viewer"] as const);

for (const role of roles) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const creds = E2E[role];
    await page.addInitScript(() => localStorage.setItem("club-intro-seen", "1"));
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password", { exact: true }).fill(creds.password);
    await page.getByRole("button", { name: "Open the ledger" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
