// Seeds settings, lookup tables and the first admin. With SEED_DEMO_DATA=true it also
// writes a realistic year and a half of members, events and transactions.
// Idempotent for lookups/admin; demo data is only inserted into an empty members table.
import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { nextCode } from "../src/server/sequence";
import { addDays, addYears, todayIST } from "../src/lib/format";

const {
  users,
  settings,
  membershipTypes,
  expenseCategories,
  members,
  events,
  transactions,
  auditLogs,
} = schema;

const SETTINGS: Record<string, string> = {
  club_name: "Rasa Club",
  club_tagline: "Every member. Every rupee. One story.",
  club_address: "12, Lake Terrace Road, Kolkata 700029, West Bengal",
  club_phone: "+91 98300 12345",
  club_email: "hello@club.rasatech.in",
  club_registration: "Regd. under the W.B. Societies Registration Act, 1961 · No. S/2L/31842",
  club_pan: "AABCR1234K",
  receipt_footer:
    "Thank you for supporting the club. This is a computer-generated receipt and does not require a signature.",
};

const MEMBERSHIP_TYPES = [
  { name: "Ordinary", annualFee: "1200.00", description: "Standard annual membership" },
  { name: "Family", annualFee: "2000.00", description: "Covers a household of up to four" },
  { name: "Student", annualFee: "600.00", description: "Full-time students under 25" },
  { name: "Senior Citizen", annualFee: "800.00", description: "Members aged 60 and above" },
  { name: "Patron", annualFee: "5000.00", description: "Patrons who sustain the club's work" },
];

const EXPENSE_CATEGORIES = [
  "Venue & Decoration",
  "Food & Refreshments",
  "Electricity & Utilities",
  "Maintenance & Repairs",
  "Printing & Stationery",
  "Sports Equipment",
  "Puja & Rituals",
  "Prizes & Mementos",
  "Transport",
  "Honorarium",
  "Bank Charges",
  "Miscellaneous",
];

// Deterministic PRNG so the demo looks the same on every machine.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261018);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

const FIRST = [
  "Arindam", "Sudipta", "Rituparna", "Debashis", "Moumita", "Sayan", "Anirban", "Tanushree",
  "Kaushik", "Priyanka", "Soumya", "Indrani", "Abhijit", "Sreya", "Rahul", "Paromita",
  "Subhajit", "Madhumita", "Arjun", "Nandini", "Tapas", "Shreya", "Bikram", "Ishita",
  "Rajat", "Poulami", "Sourav", "Ankita", "Joydeep", "Mitali", "Kunal", "Debolina",
  "Pritam", "Sharmistha", "Amitava", "Rimpa", "Neel", "Aparna",
];
const LAST = [
  "Banerjee", "Chatterjee", "Mukherjee", "Ganguly", "Ghosh", "Bose", "Das", "Sen", "Roy",
  "Dutta", "Sarkar", "Majumdar", "Bhattacharya", "Chakraborty", "Mitra", "Pal", "Saha", "Nandi",
];
const STREETS = [
  "Lake Terrace Road", "Southern Avenue", "Rashbehari Avenue", "Hindustan Park", "Purna Das Road",
  "Sarat Bose Road", "Dover Lane", "Gariahat Road", "Fern Road", "Ballygunge Place",
];
const SPONSORS = [
  "Maa Tara Jewellers", "Bose Electricals", "Sarkar Sweets & Caterers", "Dakshin Kolkata Motors",
  "Lakeview Diagnostics", "Ganguly Hardware Stores", "Chatterjee & Sons Publishers",
];
const DONORS = [
  "Smt. Kalyani Dey", "Sri Prabir Kumar Saha", "Anonymous well-wisher", "Dr. Sumit Halder",
  "Lake Residents' Welfare Association", "Sri Ashok Mondal", "Smt. Rina Basu",
];
const VENDORS: Record<string, string[]> = {
  "Venue & Decoration": ["Ma Durga Decorators", "Kumartuli Pandal Works", "Light House Illuminations"],
  "Food & Refreshments": ["Sarkar Sweets & Caterers", "Bhojohori Caterers", "Annapurna Bhandar"],
  "Electricity & Utilities": ["CESC Ltd.", "CESC Ltd. (temporary connection)"],
  "Maintenance & Repairs": ["Sharma Plumbing Works", "Biswas Carpentry", "City Paint House"],
  "Printing & Stationery": ["Saraswati Press", "Print Point Gariahat"],
  "Sports Equipment": ["Khelaghor Sports", "Decathlon Ruby"],
  "Puja & Rituals": ["Purohit Sri Haradhan Chakraborty", "Kalighat Flower Market"],
  "Prizes & Mementos": ["Memento House", "Trophy Centre College Street"],
  Transport: ["Dakshin Kolkata Motors", "Ola Fleet Partner"],
  Honorarium: ["Sri Bablu Mondal (caretaker)", "Smt. Laxmi Das (cleaning)"],
  "Bank Charges": ["State Bank of India"],
  Miscellaneous: ["Big Bazaar Lake Mall", "Local vendor"],
};

const EVENT_SEED = [
  { name: "Durga Puja 2025", date: "2025-09-28", venue: "Club grounds, Lake Terrace", budget: 450000, status: "COMPLETED" },
  { name: "Lakshmi Puja & Bijoya Sammilani", date: "2025-10-06", venue: "Club hall", budget: 60000, status: "COMPLETED" },
  { name: "Kali Puja & Diwali Night", date: "2025-10-20", venue: "Club grounds", budget: 120000, status: "COMPLETED" },
  { name: "Annual Sports Meet", date: "2026-01-11", venue: "Deshapriya Park", budget: 80000, status: "COMPLETED" },
  { name: "Republic Day Flag Hoisting", date: "2026-01-26", venue: "Club grounds", budget: 15000, status: "COMPLETED" },
  { name: "Saraswati Puja", date: "2026-01-23", venue: "Club hall", budget: 55000, status: "COMPLETED" },
  { name: "Rabindra Jayanti Evening", date: "2026-05-09", venue: "Club hall", budget: 30000, status: "COMPLETED" },
  { name: "Blood Donation Camp", date: "2026-06-14", venue: "Club hall", budget: 25000, status: "COMPLETED" },
  { name: "Independence Day", date: "2026-08-15", venue: "Club grounds", budget: 18000, status: "COMPLETED" },
  { name: "Durga Puja 2026", date: "2026-10-17", venue: "Club grounds, Lake Terrace", budget: 500000, status: "PLANNED" },
  { name: "Kali Puja & Diwali Night 2026", date: "2026-11-08", venue: "Club grounds", budget: 130000, status: "PLANNED" },
] as const;

type TxnDraft = Omit<typeof transactions.$inferInsert, "txnCode">;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = mysql.createPool({ uri: url, timezone: "Z", connectionLimit: 2 });
  const db = drizzle(pool, { schema, mode: "default" });

  // --- settings
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { key } });
  }

  // --- lookups
  for (const t of MEMBERSHIP_TYPES) {
    await db.insert(membershipTypes).values(t).onDuplicateKeyUpdate({ set: { name: t.name } });
  }
  for (const name of EXPENSE_CATEGORIES) {
    await db.insert(expenseCategories).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  }

  // --- admin
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase().trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!adminEmail || adminPassword.length < 10) {
    throw new Error("Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 10 characters");
  }
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  let adminId = existingAdmin[0]?.id;
  if (!adminId) {
    const [res] = await db.insert(users).values({
      name: process.env.SEED_ADMIN_NAME ?? "Club Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
    });
    adminId = res.insertId;
    console.log(`✓ admin created: ${adminEmail}`);
  } else {
    console.log(`• admin exists: ${adminEmail}`);
  }

  if (process.env.SEED_DEMO_USERS === "true") {
    const demo = [
      { name: "Sourav Mitra", email: "treasurer@club.local", password: "ClubTreasurer@2026", role: "TREASURER" as const },
      { name: "Ishita Pal", email: "viewer@club.local", password: "ClubViewer@2026", role: "VIEWER" as const },
    ];
    for (const u of demo) {
      const found = await db.select({ id: users.id }).from(users).where(eq(users.email, u.email));
      if (!found.length) {
        await db.insert(users).values({
          name: u.name,
          email: u.email,
          role: u.role,
          passwordHash: await bcrypt.hash(u.password, 12),
        });
      }
    }
    console.log("✓ demo treasurer/viewer users ensured");
  }

  if (process.env.SEED_DEMO_DATA !== "true") {
    await pool.end();
    return;
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(members);
  if (Number(count) > 0) {
    console.log("• demo data skipped (members already exist)");
    await pool.end();
    return;
  }

  const today = todayIST();
  const types = await db.select().from(membershipTypes);
  const cats = await db.select().from(expenseCategories);
  const catId = (name: string) => cats.find((c) => c.name === name)!.id;

  // --- events
  const eventRows: { id: number; name: string; date: string; budget: number }[] = [];
  await db.transaction(async (tx) => {
    for (const e of EVENT_SEED) {
      const code = await nextCode(tx, "EVT", e.date.slice(0, 4), 3);
      const [res] = await tx.insert(events).values({
        eventCode: code,
        name: e.name,
        eventDate: e.date,
        venue: e.venue,
        budget: e.budget.toFixed(2),
        status: e.status,
        description: `${e.name} organised by the club for members and neighbours.`,
        createdById: adminId,
      });
      eventRows.push({ id: res.insertId, name: e.name, date: e.date, budget: e.budget });
    }
  });

  // --- members
  const usedNames = new Set<string>();
  const memberRows: {
    id: number;
    name: string;
    fee: number;
    renewal: string;
    joined: string;
    active: boolean;
  }[] = [];
  const typeWeights = ["Ordinary", "Ordinary", "Ordinary", "Ordinary", "Family", "Family", "Student", "Senior Citizen", "Senior Citizen", "Patron"];
  const MEMBER_COUNT = 42;
  await db.transaction(async (tx) => {
    for (let i = 0; i < MEMBER_COUNT; i++) {
      let name = "";
      do name = `${pick(FIRST)} ${pick(LAST)}`;
      while (usedNames.has(name));
      usedNames.add(name);
      const typeName = pick(typeWeights);
      const type = types.find((t) => t.name === typeName)!;
      const joinYear = between(2016, 2026);
      let joined = `${joinYear}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`;
      if (joined > today) joined = addDays(today, -between(20, 200));

      // Renewal spread: ~12% overdue, ~14% due within 30 days, the rest paid ahead.
      const r = rand();
      let renewal: string;
      if (r < 0.12) renewal = addDays(today, -between(5, 120));
      else if (r < 0.26) renewal = addDays(today, between(0, 30));
      else renewal = addDays(today, between(31, 340));
      if (renewal <= joined) renewal = addYears(joined, 1);

      const active = i % 17 !== 5; // a couple of deactivated members
      const code = await nextCode(tx, "MEM", joined.slice(0, 4), 4);
      const phone = `+91 ${pick(["98300", "98310", "90070", "83350", "97480", "62900"])} ${String(between(10000, 99999))}`;
      const [res] = await tx.insert(members).values({
        memberCode: code,
        fullName: name,
        phone,
        email: rand() < 0.7 ? `${name.toLowerCase().replace(/\s+/, ".")}@example.in` : null,
        address: `${between(1, 220)}/${between(1, 9)}, ${pick(STREETS)}, Kolkata 7000${between(19, 45)}`,
        joiningDate: joined,
        membershipTypeId: type.id,
        annualFee: type.annualFee,
        renewalDate: renewal,
        status: active ? "ACTIVE" : "INACTIVE",
        deactivatedAt: active ? null : new Date(`${addDays(today, -between(30, 200))}T10:00:00Z`),
        deactivationReason: active ? null : "Moved out of Kolkata",
        createdById: adminId,
      });
      memberRows.push({ id: res.insertId, name, fee: Number(type.annualFee), renewal, joined, active });
    }
  });

  // --- transactions
  const START = "2025-04-01";
  const drafts: TxnDraft[] = [];
  const modeFor = (amount: number) => {
    const r = rand();
    if (amount >= 20000) return r < 0.75 ? "BANK" : "UPI";
    if (amount <= 1500) return r < 0.5 ? "UPI" : r < 0.85 ? "CASH" : "BANK";
    return r < 0.45 ? "UPI" : r < 0.75 ? "BANK" : "CASH";
  };
  const upiRef = () => `UPI/${between(300000000, 999999999)}${between(100, 999)}`;
  const bankRef = () => `NEFT/SBIN${between(10000000, 99999999)}`;
  const ref = (mode: string) => (mode === "UPI" ? upiRef() : mode === "BANK" ? bankRef() : null);

  // Balances carried over from the previous books, so each mode starts where the old ledger ended.
  for (const [mode, amount] of [["CASH", 42000], ["BANK", 385000]] as const) {
    drafts.push({
      kind: "INCOME",
      incomeCategory: "OTHER",
      amount: amount.toFixed(2),
      txnDate: START,
      mode,
      partyName: "Opening balance",
      description: "Balance brought forward from FY 2024–25",
      status: "COMPLETED",
    });
  }

  // Subscriptions: the year that ends at each member's renewal date, and the one before.
  for (const m of memberRows) {
    for (const back of [1, 2]) {
      const paidOn = addDays(addYears(m.renewal, -back), between(-12, 6));
      if (paidOn < START || paidOn > today || paidOn < m.joined) continue;
      const mode = modeFor(m.fee);
      drafts.push({
        kind: "INCOME",
        incomeCategory: "SUBSCRIPTION",
        amount: m.fee.toFixed(2),
        txnDate: paidOn,
        mode,
        referenceNo: ref(mode),
        partyName: m.name,
        memberId: m.id,
        description: `Annual subscription ${paidOn.slice(0, 4)}–${String(Number(paidOn.slice(0, 4)) + 1).slice(2)}`,
        status: "COMPLETED",
      });
    }
  }

  // Event-linked money: sponsorships, donations and the bills that follow.
  for (const e of eventRows) {
    const upcoming = e.date > today;
    const sponsorCount = Math.max(1, Math.round(e.budget / 90000));
    for (let s = 0; s < sponsorCount; s++) {
      const date = addDays(e.date, -between(5, 40));
      if (date < START) continue;
      const amount = roundTo(between(10000, Math.max(15000, e.budget * 0.35)), 1000);
      const pending = date > today || (upcoming && rand() < 0.4);
      const mode = modeFor(amount);
      drafts.push({
        kind: "INCOME",
        incomeCategory: "SPONSORSHIP",
        amount: amount.toFixed(2),
        txnDate: date > today ? today : date,
        dueDate: pending ? addDays(e.date, -2) : null,
        mode,
        referenceNo: pending ? null : ref(mode),
        partyName: pick(SPONSORS),
        eventId: e.id,
        description: `Title sponsorship — ${e.name}`,
        status: pending ? "PENDING" : "COMPLETED",
      });
    }
    const donationCount = between(3, 9);
    for (let d = 0; d < donationCount; d++) {
      const date = addDays(e.date, -between(0, 30));
      if (date < START || date > today) continue;
      const amount = roundTo(between(501, 15001), rand() < 0.5 ? 100 : 1) + (rand() < 0.4 ? 1 : 0);
      const mode = modeFor(amount);
      drafts.push({
        kind: "INCOME",
        incomeCategory: "DONATION",
        amount: amount.toFixed(2),
        txnDate: date,
        mode,
        referenceNo: ref(mode),
        partyName: pick(DONORS),
        eventId: e.id,
        description: `Donation towards ${e.name}`,
        status: "COMPLETED",
      });
    }
    if (upcoming) continue;
    // Spend roughly 70–105% of the budget across 4–9 bills.
    const spend = e.budget * (0.7 + rand() * 0.35);
    const bills = between(4, 9);
    const catsForEvent = e.name.includes("Puja")
      ? ["Venue & Decoration", "Puja & Rituals", "Food & Refreshments", "Electricity & Utilities", "Printing & Stationery", "Transport"]
      : e.name.includes("Sports")
        ? ["Sports Equipment", "Prizes & Mementos", "Food & Refreshments", "Transport", "Printing & Stationery"]
        : ["Venue & Decoration", "Food & Refreshments", "Printing & Stationery", "Prizes & Mementos"];
    for (let b = 0; b < bills; b++) {
      const cat = pick(catsForEvent);
      const amount = roundTo((spend / bills) * (0.5 + rand()), 10);
      const date = addDays(e.date, between(-10, 4));
      if (date < START || date > today) continue;
      const mode = modeFor(amount);
      drafts.push({
        kind: "EXPENSE",
        expenseCategoryId: catId(cat),
        amount: amount.toFixed(2),
        txnDate: date,
        mode,
        referenceNo: ref(mode),
        partyName: pick(VENDORS[cat]!),
        eventId: e.id,
        description: `${cat} for ${e.name}`,
        status: "COMPLETED",
      });
    }
  }

  // Running costs every month.
  for (let month = new Date(`${START}T00:00:00Z`); month.toISOString().slice(0, 10) <= today; month.setUTCMonth(month.getUTCMonth() + 1)) {
    const ym = month.toISOString().slice(0, 7);
    const recurring: [string, number, number, number][] = [
      ["Electricity & Utilities", 1800, 4200, 6],
      ["Honorarium", 6000, 6000, 3],
      ["Maintenance & Repairs", 500, 6000, 18],
      ["Bank Charges", 59, 236, 28],
      ["Miscellaneous", 200, 2500, 22],
    ];
    for (const [cat, min, max, day] of recurring) {
      if (cat === "Maintenance & Repairs" && rand() < 0.4) continue;
      const date = `${ym}-${String(day).padStart(2, "0")}`;
      if (date > today) continue;
      const amount = roundTo(between(min, max), cat === "Bank Charges" ? 1 : 10);
      const mode = cat === "Bank Charges" ? "BANK" : cat === "Honorarium" ? "CASH" : modeFor(amount);
      drafts.push({
        kind: "EXPENSE",
        expenseCategoryId: catId(cat),
        amount: amount.toFixed(2),
        txnDate: date,
        mode,
        referenceNo: ref(mode),
        partyName: pick(VENDORS[cat]!),
        description: cat === "Honorarium" ? `Caretaker honorarium for ${ym}` : `${cat} — ${ym}`,
        status: "COMPLETED",
      });
    }
    // Small walk-in donations to the general fund.
    for (let k = 0; k < between(0, 3); k++) {
      const date = `${ym}-${String(between(1, 28)).padStart(2, "0")}`;
      if (date > today) continue;
      const amount = pick([251, 501, 1001, 2100, 5001]);
      const mode = modeFor(amount);
      drafts.push({
        kind: "INCOME",
        incomeCategory: pick(["DONATION", "DONATION", "OTHER"]),
        amount: amount.toFixed(2),
        txnDate: date,
        mode,
        referenceNo: ref(mode),
        partyName: pick(DONORS),
        description: "General fund",
        status: "COMPLETED",
      });
    }
    // Hall bookings bring in a little "other" income.
    if (rand() < 0.45) {
      const date = `${ym}-${String(between(1, 28)).padStart(2, "0")}`;
      if (date <= today) {
        drafts.push({
          kind: "INCOME",
          incomeCategory: "OTHER",
          amount: pick([3000, 3500, 5000]).toFixed(2),
          txnDate: date,
          mode: "UPI",
          referenceNo: upiRef(),
          partyName: `${pick(FIRST)} ${pick(LAST)}`,
          description: "Club hall booking",
          status: "COMPLETED",
        });
      }
    }
  }

  // Money promised but not yet moved: pledges to collect and a bill to settle.
  const kali = eventRows.find((e) => e.name === "Kali Puja & Diwali Night 2026")!;
  const puja = eventRows.find((e) => e.name === "Durga Puja 2026")!;
  const pendings: [TxnDraft["kind"], string, number, string, number, string][] = [
    ["INCOME", "Maa Tara Jewellers", 50000, "Title sponsorship pledge", kali.id, addDays(kali.date, -5)],
    ["INCOME", "Lakeview Diagnostics", 25000, "Co-sponsorship pledge", kali.id, addDays(kali.date, -5)],
    ["INCOME", "Dr. Sumit Halder", 11000, "Donation pledged at Bijoya meeting", puja.id, addDays(today, 10)],
    ["EXPENSE", "Light House Illuminations", 38000, "Balance due for pandal lighting", puja.id, addDays(today, 7)],
    ["EXPENSE", "Bhojohori Caterers", 22500, "Bhog catering — final instalment", puja.id, addDays(today, 4)],
  ];
  for (const [kind, party, amount, description, eventId, dueDate] of pendings) {
    drafts.push({
      kind,
      incomeCategory: kind === "INCOME" ? (party.startsWith("Dr.") ? "DONATION" : "SPONSORSHIP") : null,
      expenseCategoryId:
        kind === "EXPENSE" ? catId(party.includes("Light") ? "Venue & Decoration" : "Food & Refreshments") : null,
      amount: amount.toFixed(2),
      txnDate: addDays(today, -between(1, 9)),
      dueDate,
      mode: "BANK",
      partyName: party,
      eventId,
      description,
      status: "PENDING",
    });
  }

  // A cancelled entry, for the audit trail story.
  drafts.push({
    kind: "EXPENSE",
    expenseCategoryId: catId("Printing & Stationery"),
    amount: "4800.00",
    txnDate: addDays(today, -40),
    mode: "CASH",
    partyName: "Saraswati Press",
    description: "Duplicate entry for souvenir printing",
    status: "VOID",
    voidReason: "Entered twice by mistake",
  });

  drafts.sort((a, b) => (a.txnDate < b.txnDate ? -1 : a.txnDate > b.txnDate ? 1 : 0));

  await db.transaction(async (tx) => {
    for (const d of drafts) {
      const year = d.txnDate.slice(0, 4);
      const txnCode = await nextCode(tx, "TXN", year);
      const receiptNo =
        d.status === "COMPLETED" ? await nextCode(tx, d.kind === "INCOME" ? "RCPT" : "VCH", year) : null;
      const createdAt = new Date(`${d.txnDate}T${String(between(4, 13)).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}:00Z`);
      await tx.insert(transactions).values({
        ...d,
        txnCode,
        receiptNo,
        createdById: adminId,
        updatedById: adminId,
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  await db.insert(auditLogs).values({
    userId: adminId,
    userName: "System",
    action: "SEED",
    entityType: "system",
    summary: `Demo data loaded: ${memberRows.length} members, ${eventRows.length} events, ${drafts.length} transactions`,
  });

  console.log(`✓ demo data: ${memberRows.length} members, ${eventRows.length} events, ${drafts.length} transactions`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
