import "server-only";
import { aliasedTable, and, asc, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  attachments,
  events,
  expenseCategories,
  INCOME_CATEGORIES,
  members,
  PAYMENT_MODES,
  transactions,
  TXN_KINDS,
  TXN_STATUSES,
  users,
  type IncomeCategory,
  type PaymentMode,
  type TxnKind,
  type TxnStatus,
} from "@/db/schema";
import { intParam, isoDate, likeTerm, oneOf, PAGE_SIZE, pageParam, param, toPage, type SearchParams } from "./common";

export type TxnFilters = {
  q?: string;
  kind?: TxnKind;
  status?: TxnStatus | "ALL";
  mode?: PaymentMode;
  incomeCategory?: IncomeCategory;
  expenseCategoryId?: number;
  eventId?: number;
  memberId?: number;
  from?: string;
  to?: string;
  sort?: "date" | "amount";
  page: number;
  pageSize: number;
};

export function parseTxnFilters(sp: SearchParams): TxnFilters {
  const statusRaw = param(sp, "status");
  return {
    q: param(sp, "q"),
    kind: oneOf(param(sp, "kind"), TXN_KINDS),
    status: statusRaw === "ALL" ? "ALL" : oneOf(statusRaw, TXN_STATUSES),
    mode: oneOf(param(sp, "mode"), PAYMENT_MODES),
    incomeCategory: oneOf(param(sp, "category"), INCOME_CATEGORIES),
    expenseCategoryId: intParam(param(sp, "expenseCategory")),
    eventId: intParam(param(sp, "event")),
    memberId: intParam(param(sp, "member")),
    from: isoDate(param(sp, "from")),
    to: isoDate(param(sp, "to")),
    sort: oneOf(param(sp, "sort"), ["date", "amount"] as const) ?? "date",
    page: pageParam(sp),
    pageSize: PAGE_SIZE,
  };
}

function txnWhere(f: Omit<TxnFilters, "page" | "pageSize" | "sort">) {
  const conds: SQL[] = [];
  if (f.kind) conds.push(eq(transactions.kind, f.kind));
  // Void entries are hidden unless explicitly asked for.
  if (!f.status) conds.push(sql`${transactions.status} <> 'VOID'`);
  else if (f.status !== "ALL") conds.push(eq(transactions.status, f.status));
  if (f.mode) conds.push(eq(transactions.mode, f.mode));
  if (f.incomeCategory) conds.push(eq(transactions.incomeCategory, f.incomeCategory));
  if (f.expenseCategoryId) conds.push(eq(transactions.expenseCategoryId, f.expenseCategoryId));
  if (f.eventId) conds.push(eq(transactions.eventId, f.eventId));
  if (f.memberId) conds.push(eq(transactions.memberId, f.memberId));
  if (f.from) conds.push(gte(transactions.txnDate, f.from));
  if (f.to) conds.push(lte(transactions.txnDate, f.to));
  if (f.q) {
    const t = likeTerm(f.q);
    conds.push(
      or(
        like(transactions.txnCode, t),
        like(transactions.receiptNo, t),
        like(transactions.partyName, t),
        like(transactions.description, t),
        like(transactions.referenceNo, t),
        like(members.fullName, t),
        like(members.memberCode, t),
        like(events.name, t),
      )!,
    );
  }
  return conds.length ? and(...conds) : undefined;
}

const listColumns = {
  id: transactions.id,
  txnCode: transactions.txnCode,
  receiptNo: transactions.receiptNo,
  kind: transactions.kind,
  incomeCategory: transactions.incomeCategory,
  expenseCategory: expenseCategories.name,
  amount: transactions.amount,
  txnDate: transactions.txnDate,
  mode: transactions.mode,
  status: transactions.status,
  referenceNo: transactions.referenceNo,
  partyName: transactions.partyName,
  description: transactions.description,
  dueDate: transactions.dueDate,
  memberId: transactions.memberId,
  memberName: members.fullName,
  memberCode: members.memberCode,
  eventId: transactions.eventId,
  eventName: events.name,
  attachmentCount: sql<number>`(select count(*) from ${attachments} where ${attachments.transactionId} = ${transactions.id})`,
};

export async function listTransactions(f: TxnFilters) {
  const where = txnWhere(f);
  const order =
    f.sort === "amount" ? [desc(transactions.amount), desc(transactions.id)] : [desc(transactions.txnDate), desc(transactions.id)];
  const [rows, [agg]] = await Promise.all([
    db
      .select(listColumns)
      .from(transactions)
      .leftJoin(members, eq(members.id, transactions.memberId))
      .leftJoin(events, eq(events.id, transactions.eventId))
      .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
      .where(where)
      .orderBy(...order)
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db
      .select({
        n: sql<number>`count(*)`,
        income: sql<string>`coalesce(sum(case when ${transactions.kind} = 'INCOME' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.kind} = 'EXPENSE' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} else 0 end), 0)`,
      })
      .from(transactions)
      .leftJoin(members, eq(members.id, transactions.memberId))
      .leftJoin(events, eq(events.id, transactions.eventId))
      .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
      .where(where),
  ]);
  return {
    ...toPage(rows, Number(agg!.n), f.page, f.pageSize),
    totals: { income: Number(agg!.income), expense: Number(agg!.expense) },
  };
}

export type TxnRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];

const createdBy = aliasedTable(users, "created_by");
const updatedBy = aliasedTable(users, "updated_by");

export async function getTransaction(id: number) {
  const [row] = await db
    .select({
      ...listColumns,
      expenseCategoryId: transactions.expenseCategoryId,
      voidReason: transactions.voidReason,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      createdByName: createdBy.name,
      updatedByName: updatedBy.name,
      memberPhone: members.phone,
      memberAddress: members.address,
    })
    .from(transactions)
    .leftJoin(members, eq(members.id, transactions.memberId))
    .leftJoin(events, eq(events.id, transactions.eventId))
    .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
    .leftJoin(createdBy, eq(createdBy.id, transactions.createdById))
    .leftJoin(updatedBy, eq(updatedBy.id, transactions.updatedById))
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) return null;
  const files = await db
    .select()
    .from(attachments)
    .where(eq(attachments.transactionId, id))
    .orderBy(asc(attachments.id));
  return { ...row, attachments: files };
}

export type TxnDetail = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export async function listExpenseCategories(activeOnly = false) {
  return db
    .select()
    .from(expenseCategories)
    .where(activeOnly ? eq(expenseCategories.isActive, true) : undefined)
    .orderBy(asc(expenseCategories.name));
}

export async function eventOptions() {
  return db
    .select({ id: events.id, name: events.name, eventDate: events.eventDate, status: events.status })
    .from(events)
    .orderBy(desc(events.eventDate));
}

export async function listPending(limit = 6) {
  return db
    .select(listColumns)
    .from(transactions)
    .leftJoin(members, eq(members.id, transactions.memberId))
    .leftJoin(events, eq(events.id, transactions.eventId))
    .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
    .where(eq(transactions.status, "PENDING"))
    .orderBy(asc(sql`coalesce(${transactions.dueDate}, ${transactions.txnDate})`))
    .limit(limit);
}

export async function listRecent(limit = 8) {
  return db
    .select(listColumns)
    .from(transactions)
    .leftJoin(members, eq(members.id, transactions.memberId))
    .leftJoin(events, eq(events.id, transactions.eventId))
    .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
    .where(sql`${transactions.status} <> 'VOID'`)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(limit);
}
