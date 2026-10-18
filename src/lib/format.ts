// Formatting helpers shared by server and client. Indian conventions throughout:
// ₹ with lakh/crore grouping, DD Mon YYYY dates, Asia/Kolkata clock, April–March financial year.

export const TIME_ZONE = "Asia/Kolkata";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** ₹1,23,456.00 */
export function formatINR(value: number | string | null | undefined, opts?: { whole?: boolean }) {
  const n = toNumber(value);
  return (opts?.whole ? inrWhole : inr).format(n);
}

/** ₹4.2L / ₹1.1Cr / ₹12.5K — for chart axes and tight spaces. */
export function formatINRCompact(value: number | string | null | undefined) {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${trim(abs)}`;
}

function trim(n: number) {
  return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "");
}

export function formatNumber(value: number | string) {
  return plain.format(toNumber(value));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-18" → "18 Oct 2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-10-18" → "18/10/2026" */
export function formatDateNumeric(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function monthLabel(ym: string, long = false) {
  const [y, m] = ym.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${long ? y : String(y).slice(2)}`;
}

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return dateTimeFmt.format(d);
}

/** Today's calendar date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA already yields YYYY-MM-DD
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addYears(iso: string, years: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  // 29 Feb → 28 Feb in non-leap years
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Indian financial year (April–March) that a date falls in, by its starting year. */
export function fyStartYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

export function fyLabel(startYear: number) {
  return `FY ${startYear}–${String(startYear + 1).slice(2)}`;
}

export function fyRange(startYear: number) {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export const MODE_LABEL = { CASH: "Cash", BANK: "Bank", UPI: "UPI" } as const;
export const INCOME_CATEGORY_LABEL = {
  DONATION: "Donation",
  SUBSCRIPTION: "Subscription",
  SPONSORSHIP: "Sponsorship",
  OTHER: "Other income",
} as const;
export const STATUS_LABEL = { COMPLETED: "Completed", PENDING: "Pending", VOID: "Void" } as const;
export const ROLE_LABEL = { ADMIN: "Admin", TREASURER: "Treasurer", VIEWER: "Viewer" } as const;

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "2026-02" → "2026-02-28" */
export function monthEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
