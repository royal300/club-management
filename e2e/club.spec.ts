import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import mysql from "mysql2/promise";
import { addYears, formatDate, formatINR, todayIST } from "../src/lib/format";
import { E2E } from "./env";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: false });

/** Every hero letter has finished rising into its line (not just present in the DOM). */
async function expectHeadlineRisen(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll(".hero-char")).every((c) => {
            const t = getComputedStyle(c).transform;
            return t === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t);
          }),
        ),
      { timeout: 8000 },
    )
    .toBe(true);
}

async function books() {
  const conn = await mysql.createConnection({ uri: E2E.dbUrl, dateStrings: true });
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT mode,
            COALESCE(SUM(CASE WHEN kind='INCOME' THEN amount ELSE 0 END),0) AS income,
            COALESCE(SUM(CASE WHEN kind='EXPENSE' THEN amount ELSE 0 END),0) AS expense
       FROM transactions WHERE status='COMPLETED' GROUP BY mode`,
  );
  await conn.end();
  const modes: Record<string, number> = { CASH: 0, BANK: 0, UPI: 0 };
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    modes[r.mode] = Number(r.income) - Number(r.expense);
    income += Number(r.income);
    expense += Number(r.expense);
  }
  return { income, expense, balance: income - expense, modes };
}

async function query<T = mysql.RowDataPacket>(sql: string, params: unknown[] = []) {
  const conn = await mysql.createConnection({ uri: E2E.dbUrl, dateStrings: true });
  const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
  await conn.end();
  return rows as T[];
}

test.use({ storageState: "e2e/.auth/admin.json" });
test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes("intro")) await page.addInitScript(() => localStorage.setItem("club-intro-seen", "1"));
});

test.describe("Sign-in", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("@smoke a wrong password is refused with a clear message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E.admin.email);
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-123");
    await page.getByRole("button", { name: "Open the ledger" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("@smoke the app is closed to signed-out visitors", async ({ page, request }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    const res = await request.get("/api/export/members?format=csv");
    expect(res.status()).toBe(401);
  });
});

test.describe("Dashboard", () => {
  test("@smoke totals and per-mode balances match the books", async ({ page }) => {
    await page.goto("/dashboard");
    // Internally consistent: balance = income − expenses = cash + bank + UPI.
    const value = async (id: string) => Number(await page.getByTestId(id).getAttribute("data-value"));
    const [balance, income, expense] = [await value("balance-total"), await value("total-income"), await value("total-expense")];
    expect(balance).toBeCloseTo(income - expense, 2);
    const modeText = await Promise.all(["CASH", "BANK", "UPI"].map((m) => page.getByTestId(`balance-${m}`).textContent()));
    const modeSum = modeText.reduce((a, t) => a + Number(t!.replace(/[^\d.-]/g, "")), 0);
    expect(modeSum).toBeCloseTo(balance, 2);
    if (!E2E.live) {
      // …and equal to what the database says.
      const b = await books();
      await expect(page.getByTestId("balance-total")).toHaveAttribute("data-final", formatINR(b.balance, { whole: true }));
      await expect(page.getByTestId("total-income")).toHaveAttribute("data-final", formatINR(b.income, { whole: true }));
      await expect(page.getByTestId("total-expense")).toHaveAttribute("data-final", formatINR(b.expense, { whole: true }));
      for (const mode of ["CASH", "BANK", "UPI"]) {
        await expect(page.getByTestId(`balance-${mode}`)).toHaveText(formatINR(b.modes[mode]!));
      }
    }
    await expect(page.getByRole("heading", { name: "Pending payments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Outstanding dues" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Event-wise finances" })).toBeVisible();
    await page.waitForTimeout(1300); // let the counters land before the screenshot
    await shot(page, "dashboard");
  });
});

test.describe.serial("Members, money and receipts", () => {
  const stamp = Date.now().toString().slice(-5);
  const memberName = `Ritwik Playwright ${stamp}`;
  let memberId = 0;

  test("add a member and collect the first year's fee", async ({ page }) => {
    await page.goto("/members/new");
    await page.getByLabel("Full name").fill(memberName);
    await page.getByLabel("Mobile number").fill("98300 54321");
    await page.getByLabel("Email").fill(`ritwik.${stamp}@example.in`);
    await page.getByLabel("Address").fill("7, Fern Road, Kolkata 700019");
    await page.getByLabel("Membership type").selectOption({ label: "Ordinary — ₹1,200/yr" });
    await expect(page.getByLabel("Annual fee (₹)")).toHaveValue("1200.00");
    await page.getByLabel("Paid by").selectOption("UPI");
    await page.getByLabel("UPI / bank reference").fill(`UPI/E2E${stamp}`);
    await shot(page, "member-form");
    await page.getByRole("button", { name: "Add member" }).click();

    await page.waitForURL(/\/members\/\d+\?welcome=1/);
    memberId = Number(page.url().match(/members\/(\d+)/)![1]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(memberName);
    await expect(page.getByText(/MEM-\d{4}-\d{4}/).first()).toBeVisible();
    await expect(page.getByText("WELCOME", { exact: true })).toBeVisible();
    // Fee collected at joining → renewal pushed a year, receipt issued.
    await expect(page.getByText(formatDate(addYears(todayIST(), 1))).first()).toBeVisible();
    await expect(page.getByText(/RCPT-\d{4}-\d{6}/)).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "member-profile");

    const [m] = await query("SELECT member_code, renewal_date, status FROM members WHERE id = ?", [memberId]);
    expect(m!.member_code).toMatch(/^MEM-\d{4}-\d{4}$/);
    expect(m!.status).toBe("ACTIVE");
  });

  test("record income with uploaded proofs and download its receipt", async ({ page, request }) => {
    const before = await books();
    await page.goto("/transactions/new?kind=INCOME");
    await page.getByLabel("Amount").fill("5001");
    await page.getByRole("radio", { name: "Donation" }).click();
    await page.getByLabel("Received from").fill(`Smt. Playwright Donor ${stamp}`);
    await page.getByRole("radio", { name: "UPI" }).click();
    await page.getByLabel("UPI transaction ID").fill(`43091${stamp}`);
    await page.getByLabel("Event").selectOption({ index: 1 });
    await page.getByLabel("Description").fill("Donation towards bhog");
    await page.getByTestId("file-input").setInputFiles([fixture("upi-proof.png"), fixture("vendor-bill.pdf")]);
    await expect(page.getByText("upi-proof.png")).toBeVisible();
    await expect(page.getByText("vendor-bill.pdf")).toBeVisible();
    await shot(page, "record-income");
    await page.getByRole("button", { name: "Record income & issue receipt" }).click();

    await page.waitForURL(/\/transactions\/\d+\?new=1/);
    const id = Number(page.url().match(/transactions\/(\d+)/)![1]);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/TXN-\d{4}-\d{6}/);
    const receiptNo = (await page.getByText(/^RCPT-\d{4}-\d{6}$/).first().textContent())!.trim();
    await expect(page.getByText("2 files on record")).toBeVisible();
    await page.waitForTimeout(2200); // the receipt "prints" and gets stamped
    await shot(page, "receipt-printing");

    // The proofs are served only through the authenticated route, with their real type.
    const files = await query("SELECT id, mime_type FROM attachments WHERE transaction_id = ? ORDER BY id", [id]);
    expect(files.map((f) => f.mime_type)).toEqual(["image/png", "application/pdf"]);
    const img = await request.get(`/api/attachments/${files[0]!.id}`);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/png");

    // Receipt PDF
    const pdf = await request.get(`/api/receipts/${id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["content-disposition"]).toContain(`${receiptNo}.pdf`);
    const body = await pdf.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(5000);

    const after = await books();
    expect(after.modes.UPI - before.modes.UPI).toBeCloseTo(5001, 2);
  });

  test("record an expense with a bill and watch cash go down", async ({ page }) => {
    const before = await books();
    await page.goto("/transactions/new?kind=EXPENSE");
    await page.getByLabel("Amount").fill("2,350");
    await page.getByLabel("Category").selectOption({ label: "Printing & Stationery" });
    await page.getByLabel("Paid to").fill("Saraswati Press");
    await page.getByRole("radio", { name: "Cash" }).click();
    await page.getByTestId("file-input").setInputFiles(fixture("vendor-bill.pdf"));
    await page.getByRole("button", { name: "Record expense" }).click();

    await page.waitForURL(/\/transactions\/\d+\?new=1/);
    await expect(page.getByText(/^VCH-\d{4}-\d{6}$/).first()).toBeVisible();
    await expect(page.getByText("1 file on record")).toBeVisible();

    const after = await books();
    expect(before.modes.CASH - after.modes.CASH).toBeCloseTo(2350, 2);
    await page.goto("/dashboard");
    await expect(page.getByTestId("balance-CASH")).toHaveText(formatINR(after.modes.CASH));
    await expect(page.getByTestId("balance-total")).toHaveAttribute("data-final", formatINR(after.balance, { whole: true }));
  });

  test("the server rejects a file that only pretends to be an image", async ({ page }) => {
    await page.goto("/transactions/new?kind=EXPENSE");
    await page.getByLabel("Amount").fill("100");
    await page.getByLabel("Category").selectOption({ label: "Miscellaneous" });
    await page.getByLabel("Paid to").fill("Local vendor");
    await page.getByTestId("file-input").setInputFiles(fixture("not-really.png"));
    await page.getByRole("button", { name: "Record expense" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "isn't a JPG, PNG, WEBP or PDF" })).toBeVisible();
    await expect(page).toHaveURL(/\/transactions\/new/);
  });

  test("a subscription payment renews the member", async ({ page }) => {
    const [before] = await query("SELECT renewal_date FROM members WHERE id = ?", [memberId]);
    await page.goto(`/transactions/new?kind=INCOME&category=SUBSCRIPTION&member=${memberId}`);
    await expect(page.getByLabel("Amount")).toHaveValue("1200");
    await expect(page.getByText(`Renew ${memberName.split(" ")[0]}’s membership`)).toBeVisible();
    await page.getByRole("radio", { name: "Cash" }).click();
    await page.getByRole("button", { name: "Record income & issue receipt" }).click();
    await page.waitForURL(/\/transactions\/\d+\?new=1/);
    const [after] = await query("SELECT renewal_date FROM members WHERE id = ?", [memberId]);
    expect(String(after!.renewal_date).slice(0, 10)).toBe(addYears(String(before!.renewal_date).slice(0, 10), 1));
  });

  test("a pledge gets its receipt only once it is received", async ({ page }) => {
    await page.goto("/transactions/new?kind=INCOME");
    await page.getByLabel("Amount").fill("25000");
    await page.getByRole("radio", { name: "Sponsorship" }).click();
    await page.getByLabel("Received from").fill(`Playwright Motors ${stamp}`);
    await page.getByRole("radio", { name: "Bank" }).click();
    await page.getByText("Not yet — a pledge").click();
    await page.getByLabel("Due by").fill(addYears(todayIST(), 0));
    await page.getByRole("button", { name: "Record pledge" }).click();
    await page.waitForURL(/\/transactions\/\d+\?new=1/);
    await expect(page.getByText("Pending — no receipt yet")).toBeVisible();

    await page.getByRole("button", { name: "Mark received" }).click();
    await page.getByLabel("Reference").fill(`NEFT/E2E${stamp}`);
    await page.getByRole("button", { name: /Settle & issue receipt/ }).click();
    await page.waitForURL(/\/transactions\/\d+\?new=1/);
    await expect(page.getByText(/^RCPT-\d{4}-\d{6}$/).first()).toBeVisible();
  });

  test("voiding keeps the entry but takes it out of the balance", async ({ page }) => {
    await page.goto("/transactions/new?kind=EXPENSE");
    await page.getByLabel("Amount").fill("999");
    await page.getByLabel("Category").selectOption({ label: "Miscellaneous" });
    await page.getByLabel("Paid to").fill("Duplicate entry");
    await page.getByRole("radio", { name: "Cash" }).click();
    await page.getByRole("button", { name: "Record expense" }).click();
    await page.waitForURL(/\/transactions\/\d+\?new=1/);
    const before = await books();
    await page.getByRole("button", { name: "Void" }).click();
    await page.getByLabel("Reason").fill("Entered twice by mistake");
    await page.getByRole("button", { name: "Void entry" }).click();
    await expect(page.getByText(/This entry was voided: Entered twice by mistake/)).toBeVisible();
    const after = await books();
    expect(after.modes.CASH - before.modes.CASH).toBeCloseTo(999, 2);
  });

  test("deactivating a member is a soft delete", async ({ page }) => {
    await page.goto(`/members/${memberId}`);
    await page.getByRole("button", { name: "Deactivate" }).click();
    await page.getByLabel("Reason").fill("Moved to Pune");
    await page.getByRole("button", { name: "Deactivate member" }).click();
    await expect(page.getByText("INACTIVE", { exact: true })).toBeVisible();
    const [m] = await query("SELECT status, deactivation_reason FROM members WHERE id = ?", [memberId]);
    expect(m).toMatchObject({ status: "INACTIVE", deactivation_reason: "Moved to Pune" });
    const payments = await query("SELECT COUNT(*) AS n FROM transactions WHERE member_id = ?", [memberId]);
    expect(Number(payments[0]!.n)).toBe(2);
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByRole("button", { name: "Deactivate" })).toBeVisible();
  });

  test("the audit log shows who changed what", async ({ page }) => {
    await page.goto(`/audit?q=${encodeURIComponent(memberName)}`);
    await expect(page.getByText(`${memberName} added`)).toBeVisible();
    await expect(page.getByText(`${memberName} deactivated: Moved to Pune`)).toBeVisible();
    await expect(page.getByText("Ananya Sen").first()).toBeVisible();
    await shot(page, "audit-log");
  });
});

test.describe("Search, filters and exports", () => {
  test("search finds members by phone", async ({ page }) => {
    const [m] = await query("SELECT full_name, phone FROM members ORDER BY id LIMIT 1");
    await page.goto(`/search?q=${encodeURIComponent(m!.phone.slice(-5))}`);
    await expect(page.getByText(m!.full_name).first()).toBeVisible();
  });

  test("@smoke transaction filters narrow the ledger", async ({ page }) => {
    await page.goto("/transactions?mode=CASH&kind=EXPENSE");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allInnerTexts()) expect(text).toContain("Cash");
    await shot(page, "transactions");
  });

  test("@smoke lists export to CSV and Excel", async ({ request }) => {
    const csv = await request.get("/api/export/transactions?format=csv&kind=INCOME");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const lines = (await csv.text()).replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toContain("Transaction ID,Receipt / voucher");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(1)) expect(line.split(",")[3]).toBe("Income");
    const members = await (await request.get("/api/export/members?format=csv")).text();
    expect(members.split("\r\n")[1]).toMatch(/,\d{5} \d{5},/); // phones readable, no stray apostrophe
    const xlsx = await request.get("/api/export/members?format=xlsx");
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
  });

  test("@smoke reports show monthly and yearly summaries", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Monthly summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Yearly summary" })).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, "reports");
  });
});

test.describe("Roles", () => {
  test.skip(E2E.live, "role accounts only exist in the local test database");

  test.describe("viewer", () => {
    test.use({ storageState: "e2e/.auth/viewer.json" });
    test("can look but not record", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByRole("button", { name: /Record/ })).toHaveCount(0);
      await page.goto("/transactions/new?kind=INCOME");
      await expect(page).toHaveURL(/\/dashboard\?denied=1/);
      await expect(page.getByText("Your role doesn’t have access to that page.")).toBeVisible();
    });
  });

  test.describe("treasurer", () => {
    test.use({ storageState: "e2e/.auth/treasurer.json" });
    test("records money but cannot open admin settings", async ({ page }) => {
      await page.goto("/transactions/new?kind=EXPENSE");
      await expect(page.getByRole("heading", { name: "Record money out" })).toBeVisible();
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/dashboard\?denied=1/);
    });
  });
});

test.describe("Admin settings", () => {
  test.skip(E2E.live, "writes users; local only");

  test("an admin adds a treasurer who can sign in with the one-time password", async ({ page, browser }) => {
    const email = `treasurer.${Date.now()}@club.local`;
    await page.goto("/settings");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Add user" }) });
    await form.getByLabel("Full name").fill("Nandini Playwright");
    await form.getByLabel("Email").fill(email);
    await form.getByRole("button", { name: "Add user" }).click();
    const password = (await page.getByTestId("temp-password").textContent())!.trim();
    expect(password).toMatch(/^Club-\w{4}-\w{4}-\w{4}$/);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(email)).toBeVisible();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const fresh = await ctx.newPage();
    await fresh.addInitScript(() => localStorage.setItem("club-intro-seen", "1"));
    await fresh.goto("/login");
    await fresh.getByLabel("Email").fill(email);
    await fresh.getByLabel("Password", { exact: true }).fill(password);
    await fresh.getByRole("button", { name: "Open the ledger" }).click();
    await fresh.waitForURL("**/dashboard");
    await expect(fresh.getByText("Treasurer").first()).toBeVisible();
    await ctx.close();
  });
});

test.describe("The story outside", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("@smoke the intro plays once, can be skipped, and the story follows", async ({ page }) => {
    await page.goto("/");
    const intro = page.locator("#club-intro");
    await expect(intro).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "intro-clubhouse");
    await page.getByRole("button", { name: /Skip intro/ }).click();
    await expect(intro).toBeHidden({ timeout: 5000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every member.");
    await expectHeadlineRisen(page);
    await shot(page, "landing-hero");
    await page.reload();
    await expect(page.locator("#club-intro")).toBeHidden();
    await expectHeadlineRisen(page);
    await page.locator("#members").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /Every member/ }).nth(1)).toBeVisible();
  });
});
