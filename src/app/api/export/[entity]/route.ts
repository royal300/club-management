import ExcelJS from "exceljs";
import { db } from "@/db";
import { formatDateTime, INCOME_CATEGORY_LABEL, MODE_LABEL, STATUS_LABEL, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { audit } from "@/server/audit";
import { getSessionUser } from "@/server/auth";
import type { SearchParams } from "@/server/queries/common";
import { listAudit, listEvents, parseAuditFilters, parseEventFilters } from "@/server/queries/finance";
import { listMembers, listRenewals, parseMemberFilters } from "@/server/queries/members";
import { listTransactions, parseTxnFilters } from "@/server/queries/transactions";

type Column = { header: string; key: string; width?: number; money?: boolean; date?: boolean };
type Sheet = { title: string; columns: Column[]; rows: Record<string, string | number | null>[] };

const ALL = 100_000;
// Indian digit grouping (₹12,34,567.00) in Excel.
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"#,##0.00';

async function build(entity: string, sp: SearchParams): Promise<Sheet | null> {
  if (entity === "members") {
    const page = await listMembers({ ...parseMemberFilters(sp), page: 1, pageSize: ALL });
    return {
      title: "Members",
      columns: [
        { header: "Member ID", key: "code", width: 16 },
        { header: "Name", key: "name", width: 26 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "Email", key: "email", width: 28 },
        { header: "Address", key: "address", width: 40 },
        { header: "Type", key: "type", width: 14 },
        { header: "Annual fee", key: "fee", money: true, width: 14 },
        { header: "Joined", key: "joined", date: true, width: 12 },
        { header: "Renewal due", key: "renewal", date: true, width: 12 },
        { header: "Status", key: "status", width: 10 },
      ],
      rows: page.rows.map((m) => ({
        code: m.memberCode,
        name: m.fullName,
        phone: m.phone,
        email: m.email,
        address: m.address,
        type: m.typeName,
        fee: Number(m.annualFee),
        joined: m.joiningDate,
        renewal: m.renewalDate,
        status: m.status === "ACTIVE" ? "Active" : "Inactive",
      })),
    };
  }
  if (entity === "renewals") {
    const [overdue, due] = await Promise.all([listRenewals("overdue"), listRenewals("due")]);
    return {
      title: "Renewals",
      columns: [
        { header: "Member ID", key: "code", width: 16 },
        { header: "Name", key: "name", width: 26 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "Annual fee", key: "fee", money: true, width: 14 },
        { header: "Renewal due", key: "renewal", date: true, width: 12 },
        { header: "Status", key: "state", width: 14 },
      ],
      rows: [...overdue.map((m) => ({ ...m, state: "Overdue" })), ...due.map((m) => ({ ...m, state: "Due in 30 days" }))].map((m) => ({
        code: m.memberCode,
        name: m.fullName,
        phone: m.phone,
        fee: Number(m.annualFee),
        renewal: m.renewalDate,
        state: m.state,
      })),
    };
  }
  if (entity === "transactions") {
    const page = await listTransactions({ ...parseTxnFilters(sp), page: 1, pageSize: ALL });
    return {
      title: "Transactions",
      columns: [
        { header: "Date", key: "date", date: true, width: 12 },
        { header: "Transaction ID", key: "code", width: 18 },
        { header: "Receipt / voucher", key: "receipt", width: 18 },
        { header: "Type", key: "kind", width: 9 },
        { header: "Category", key: "category", width: 22 },
        { header: "Party", key: "party", width: 28 },
        { header: "Member ID", key: "member", width: 15 },
        { header: "Event", key: "event", width: 26 },
        { header: "Mode", key: "mode", width: 8 },
        { header: "Reference", key: "reference", width: 24 },
        { header: "Status", key: "status", width: 11 },
        { header: "Income", key: "income", money: true, width: 14 },
        { header: "Expense", key: "expense", money: true, width: 14 },
        { header: "Description", key: "description", width: 40 },
      ],
      rows: page.rows.map((t) => ({
        date: t.txnDate,
        code: t.txnCode,
        receipt: t.receiptNo,
        kind: t.kind === "INCOME" ? "Income" : "Expense",
        category: t.kind === "INCOME" ? INCOME_CATEGORY_LABEL[t.incomeCategory ?? "OTHER"] : t.expenseCategory,
        party: t.partyName ?? t.memberName,
        member: t.memberCode,
        event: t.eventName,
        mode: MODE_LABEL[t.mode],
        reference: t.referenceNo,
        status: STATUS_LABEL[t.status],
        income: t.kind === "INCOME" ? Number(t.amount) : null,
        expense: t.kind === "EXPENSE" ? Number(t.amount) : null,
        description: t.description,
      })),
    };
  }
  if (entity === "events") {
    const page = await listEvents({ ...parseEventFilters(sp), page: 1, pageSize: ALL });
    return {
      title: "Events",
      columns: [
        { header: "Event ID", key: "code", width: 14 },
        { header: "Name", key: "name", width: 32 },
        { header: "Date", key: "date", date: true, width: 12 },
        { header: "Venue", key: "venue", width: 28 },
        { header: "Status", key: "status", width: 12 },
        { header: "Budget", key: "budget", money: true, width: 14 },
        { header: "Income", key: "income", money: true, width: 14 },
        { header: "Expense", key: "expense", money: true, width: 14 },
        { header: "Net", key: "net", money: true, width: 14 },
        { header: "Pending pledges", key: "pending", money: true, width: 16 },
      ],
      rows: page.rows.map((e) => ({
        code: e.eventCode,
        name: e.name,
        date: e.eventDate,
        venue: e.venue,
        status: e.status[0] + e.status.slice(1).toLowerCase(),
        budget: e.budget,
        income: e.income,
        expense: e.expense,
        net: e.net,
        pending: e.pending,
      })),
    };
  }
  if (entity === "audit") {
    const page = await listAudit({ ...parseAuditFilters(sp), page: 1, pageSize: ALL });
    return {
      title: "Audit log",
      columns: [
        { header: "When (IST)", key: "when", width: 22 },
        { header: "User", key: "user", width: 20 },
        { header: "Action", key: "action", width: 14 },
        { header: "Record", key: "entity", width: 18 },
        { header: "Summary", key: "summary", width: 60 },
        { header: "Changes", key: "changes", width: 60 },
        { header: "IP", key: "ip", width: 16 },
      ],
      rows: page.rows.map((a) => ({
        when: formatDateTime(a.createdAt),
        user: a.userName,
        action: a.action,
        entity: `${a.entityType}${a.entityId ? ` #${a.entityId}` : ""}`,
        summary: a.summary,
        changes: a.changes ? Object.entries(a.changes).map(([k, c]) => `${k}: ${c.from ?? "—"} → ${c.to ?? "—"}`).join("; ") : null,
        ip: a.ip,
      })),
    };
  }
  return null;
}

function csvCell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request, ctx: RouteContext<"/api/export/[entity]">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { entity } = await ctx.params;
  if (!can(user.role, "export") || (entity === "audit" && !can(user.role, "audit:read"))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const sheet = await build(entity, sp);
  if (!sheet) return Response.json({ error: "Unknown export" }, { status: 404 });

  await audit(db, user, { action: "EXPORT", entityType: entity, summary: `${sheet.title} exported as ${format.toUpperCase()} (${sheet.rows.length} rows)` });
  const filename = `${entity}-${todayIST()}.${format}`;

  if (format === "csv") {
    const lines = [sheet.columns.map((c) => csvCell(c.header)).join(",")];
    // Indian mobiles go out in national form ("98300 12345"): spreadsheets read it as text,
    // so it needs no formula-guard apostrophe.
    const cell = (key: string, v: string | number | null | undefined) =>
      csvCell(key === "phone" && typeof v === "string" ? v.replace(/^\+91\s*/, "") : v);
    for (const row of sheet.rows) lines.push(sheet.columns.map((c) => cell(c.key, row[c.key])).join(","));
    return new Response(`﻿${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Club ledger";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheet.title, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  for (const row of sheet.rows) {
    const out: Record<string, unknown> = { ...row };
    for (const c of sheet.columns) {
      if (c.date && typeof row[c.key] === "string") out[c.key] = new Date(`${row[c.key]}T00:00:00Z`);
    }
    ws.addRow(out);
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFF7F1E3" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3D2F" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  for (const c of sheet.columns) {
    const col = ws.getColumn(c.key);
    if (c.money) col.numFmt = INR_FORMAT;
    if (c.date) col.numFmt = "dd/mm/yyyy";
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
