import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { MEMBER_STATUSES, members, membershipTypes, transactions } from "@/db/schema";
import { addDays, todayIST } from "@/lib/format";
import { intParam, isoDate, likeTerm, oneOf, PAGE_SIZE, pageParam, param, toPage, type SearchParams } from "./common";

export const RENEWAL_FILTERS = ["overdue", "due", "current"] as const;
export type RenewalFilter = (typeof RENEWAL_FILTERS)[number];
export const DUE_WINDOW_DAYS = 30;

export type MemberFilters = {
  q?: string;
  status?: (typeof MEMBER_STATUSES)[number];
  typeId?: number;
  renewal?: RenewalFilter;
  joinedFrom?: string;
  joinedTo?: string;
  sort?: "name" | "joined" | "renewal" | "code";
  page: number;
  pageSize: number;
};

export function parseMemberFilters(sp: SearchParams): MemberFilters {
  return {
    q: param(sp, "q"),
    status: oneOf(param(sp, "status"), MEMBER_STATUSES) ?? (param(sp, "status") === "all" ? undefined : "ACTIVE"),
    typeId: intParam(param(sp, "type")),
    renewal: oneOf(param(sp, "renewal"), RENEWAL_FILTERS),
    joinedFrom: isoDate(param(sp, "from")),
    joinedTo: isoDate(param(sp, "to")),
    sort: oneOf(param(sp, "sort"), ["name", "joined", "renewal", "code"] as const) ?? "name",
    page: pageParam(sp),
    pageSize: PAGE_SIZE,
  };
}

function memberWhere(f: Omit<MemberFilters, "page" | "pageSize" | "sort">) {
  const today = todayIST();
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(members.status, f.status));
  if (f.typeId) conds.push(eq(members.membershipTypeId, f.typeId));
  if (f.joinedFrom) conds.push(gte(members.joiningDate, f.joinedFrom));
  if (f.joinedTo) conds.push(lte(members.joiningDate, f.joinedTo));
  if (f.renewal === "overdue") conds.push(lt(members.renewalDate, today));
  if (f.renewal === "due") {
    conds.push(gte(members.renewalDate, today), lte(members.renewalDate, addDays(today, DUE_WINDOW_DAYS)));
  }
  if (f.renewal === "current") conds.push(sql`${members.renewalDate} > ${addDays(today, DUE_WINDOW_DAYS)}`);
  if (f.q) {
    const t = likeTerm(f.q);
    conds.push(
      or(
        like(members.fullName, t),
        like(members.memberCode, t),
        like(members.phone, t),
        like(members.email, t),
        like(members.address, t),
      )!,
    );
  }
  return conds.length ? and(...conds) : undefined;
}

const memberColumns = {
  id: members.id,
  memberCode: members.memberCode,
  fullName: members.fullName,
  phone: members.phone,
  email: members.email,
  address: members.address,
  joiningDate: members.joiningDate,
  renewalDate: members.renewalDate,
  annualFee: members.annualFee,
  status: members.status,
  typeName: membershipTypes.name,
  membershipTypeId: members.membershipTypeId,
};

export async function listMembers(f: MemberFilters) {
  const where = memberWhere(f);
  const order =
    f.sort === "joined"
      ? [desc(members.joiningDate)]
      : f.sort === "renewal"
        ? [asc(members.renewalDate)]
        : f.sort === "code"
          ? [asc(members.memberCode)]
          : [asc(members.fullName)];
  const [rows, [count]] = await Promise.all([
    db
      .select(memberColumns)
      .from(members)
      .innerJoin(membershipTypes, eq(membershipTypes.id, members.membershipTypeId))
      .where(where)
      .orderBy(...order)
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)` }).from(members).where(where),
  ]);
  return toPage(rows, Number(count!.n), f.page, f.pageSize);
}

export type MemberRow = Awaited<ReturnType<typeof listMembers>>["rows"][number];

export async function getMember(id: number) {
  const [row] = await db
    .select({
      ...memberColumns,
      notes: members.notes,
      deactivatedAt: members.deactivatedAt,
      deactivationReason: members.deactivationReason,
      createdAt: members.createdAt,
      updatedAt: members.updatedAt,
    })
    .from(members)
    .innerJoin(membershipTypes, eq(membershipTypes.id, members.membershipTypeId))
    .where(eq(members.id, id))
    .limit(1);
  return row ?? null;
}

export async function getMemberPayments(memberId: number) {
  return db
    .select({
      id: transactions.id,
      txnCode: transactions.txnCode,
      receiptNo: transactions.receiptNo,
      incomeCategory: transactions.incomeCategory,
      amount: transactions.amount,
      txnDate: transactions.txnDate,
      mode: transactions.mode,
      status: transactions.status,
      description: transactions.description,
    })
    .from(transactions)
    .where(and(eq(transactions.memberId, memberId), eq(transactions.kind, "INCOME")))
    .orderBy(desc(transactions.txnDate), desc(transactions.id));
}

export async function listMembershipTypes(activeOnly = false) {
  return db
    .select()
    .from(membershipTypes)
    .where(activeOnly ? eq(membershipTypes.isActive, true) : undefined)
    .orderBy(asc(membershipTypes.annualFee));
}

export const getRenewalCounts = cache(async () => {
  const today = todayIST();
  const soon = addDays(today, DUE_WINDOW_DAYS);
  const [row] = await db
    .select({
      overdue: sql<number>`sum(case when ${members.renewalDate} < ${today} then 1 else 0 end)`,
      overdueAmount: sql<string>`coalesce(sum(case when ${members.renewalDate} < ${today} then ${members.annualFee} else 0 end), 0)`,
      dueSoon: sql<number>`sum(case when ${members.renewalDate} between ${today} and ${soon} then 1 else 0 end)`,
      dueSoonAmount: sql<string>`coalesce(sum(case when ${members.renewalDate} between ${today} and ${soon} then ${members.annualFee} else 0 end), 0)`,
      active: sql<number>`count(*)`,
    })
    .from(members)
    .where(eq(members.status, "ACTIVE"));
  return {
    overdue: Number(row?.overdue ?? 0),
    overdueAmount: Number(row?.overdueAmount ?? 0),
    dueSoon: Number(row?.dueSoon ?? 0),
    dueSoonAmount: Number(row?.dueSoonAmount ?? 0),
    active: Number(row?.active ?? 0),
  };
});

/** Members whose renewal is overdue or falls due within the window, soonest first. */
export async function listRenewals(kind: "overdue" | "due", limit?: number) {
  const today = todayIST();
  const where =
    kind === "overdue"
      ? and(eq(members.status, "ACTIVE"), lt(members.renewalDate, today))
      : and(eq(members.status, "ACTIVE"), gte(members.renewalDate, today), lte(members.renewalDate, addDays(today, DUE_WINDOW_DAYS)));
  const q = db
    .select(memberColumns)
    .from(members)
    .innerJoin(membershipTypes, eq(membershipTypes.id, members.membershipTypeId))
    .where(where)
    .orderBy(asc(members.renewalDate));
  return limit ? q.limit(limit) : q;
}

export async function searchMembersLite(q: string, limit = 8) {
  const t = likeTerm(q);
  return db
    .select({ id: members.id, memberCode: members.memberCode, fullName: members.fullName, phone: members.phone, annualFee: members.annualFee, status: members.status })
    .from(members)
    .where(or(like(members.fullName, t), like(members.memberCode, t), like(members.phone, t)))
    .orderBy(asc(members.fullName))
    .limit(limit);
}

export async function memberOptions() {
  return db
    .select({ id: members.id, memberCode: members.memberCode, fullName: members.fullName, annualFee: members.annualFee, renewalDate: members.renewalDate })
    .from(members)
    .where(eq(members.status, "ACTIVE"))
    .orderBy(asc(members.fullName));
}
