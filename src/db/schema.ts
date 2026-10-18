import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

// MySQL hands JSON back parsed, MariaDB hands it back as text — accept both.
const jsonColumn = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "json",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === "string" ? (JSON.parse(value) as T) : (value as T)),
  })(name);

// All DATETIME columns are written and read as UTC by the app (never DB defaults),
// all DATE columns are plain calendar dates (YYYY-MM-DD) in Indian time.
const now = () => new Date();
const createdAt = () => datetime("created_at", { mode: "date" }).notNull().$defaultFn(now);
const updatedAt = () =>
  datetime("updated_at", { mode: "date" }).notNull().$defaultFn(now).$onUpdateFn(now);

export const ROLES = ["ADMIN", "TREASURER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_MODES = ["CASH", "BANK", "UPI"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const TXN_KINDS = ["INCOME", "EXPENSE"] as const;
export type TxnKind = (typeof TXN_KINDS)[number];

export const INCOME_CATEGORIES = ["DONATION", "SUBSCRIPTION", "SPONSORSHIP", "OTHER"] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const TXN_STATUSES = ["COMPLETED", "PENDING", "VOID"] as const;
export type TxnStatus = (typeof TXN_STATUSES)[number];

export const MEMBER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const EVENT_STATUSES = ["PLANNED", "COMPLETED", "CANCELLED"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ROLES).notNull().default("VIEWER"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: datetime("last_login_at", { mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    // sha256(token) — the raw token only ever lives in the user's cookie.
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = mysqlTable(
  "login_attempts",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.keyHash, t.createdAt)],
);

export const membershipTypes = mysqlTable("membership_types", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  annualFee: decimal("annual_fee", { precision: 12, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const members = mysqlTable(
  "members",
  {
    id: int("id").autoincrement().primaryKey(),
    memberCode: varchar("member_code", { length: 20 }).notNull().unique(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 190 }),
    address: text("address"),
    joiningDate: date("joining_date", { mode: "string" }).notNull(),
    membershipTypeId: int("membership_type_id")
      .notNull()
      .references(() => membershipTypes.id),
    annualFee: decimal("annual_fee", { precision: 12, scale: 2 }).notNull(),
    // The date the next annual fee is due. Advances by a year with each subscription paid.
    renewalDate: date("renewal_date", { mode: "string" }).notNull(),
    status: mysqlEnum("status", MEMBER_STATUSES).notNull().default("ACTIVE"),
    deactivatedAt: datetime("deactivated_at", { mode: "date" }),
    deactivationReason: varchar("deactivation_reason", { length: 255 }),
    notes: text("notes"),
    createdById: int("created_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("members_name_idx").on(t.fullName),
    index("members_phone_idx").on(t.phone),
    index("members_status_renewal_idx").on(t.status, t.renewalDate),
  ],
);

export const events = mysqlTable(
  "events",
  {
    id: int("id").autoincrement().primaryKey(),
    eventCode: varchar("event_code", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 150 }).notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    venue: varchar("venue", { length: 190 }),
    description: text("description"),
    budget: decimal("budget", { precision: 12, scale: 2 }),
    status: mysqlEnum("status", EVENT_STATUSES).notNull().default("PLANNED"),
    createdById: int("created_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("events_date_idx").on(t.eventDate)],
);

export const expenseCategories = mysqlTable("expense_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    txnCode: varchar("txn_code", { length: 24 }).notNull().unique(),
    // RCPT-YYYY-NNNNNN for income, VCH-YYYY-NNNNNN for expenses. Issued once the money has moved.
    receiptNo: varchar("receipt_no", { length: 24 }).unique(),
    kind: mysqlEnum("kind", TXN_KINDS).notNull(),
    incomeCategory: mysqlEnum("income_category", INCOME_CATEGORIES),
    expenseCategoryId: int("expense_category_id").references(() => expenseCategories.id),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    txnDate: date("txn_date", { mode: "string" }).notNull(),
    mode: mysqlEnum("mode", PAYMENT_MODES).notNull(),
    status: mysqlEnum("status", TXN_STATUSES).notNull().default("COMPLETED"),
    referenceNo: varchar("reference_no", { length: 80 }),
    partyName: varchar("party_name", { length: 150 }),
    description: text("description"),
    memberId: int("member_id").references(() => members.id),
    eventId: int("event_id").references(() => events.id),
    dueDate: date("due_date", { mode: "string" }),
    voidReason: varchar("void_reason", { length: 255 }),
    createdById: int("created_by_id").references(() => users.id),
    updatedById: int("updated_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("txn_date_idx").on(t.txnDate),
    index("txn_kind_status_idx").on(t.kind, t.status),
    index("txn_member_idx").on(t.memberId),
    index("txn_event_idx").on(t.eventId),
    index("txn_mode_idx").on(t.mode),
  ],
);

export const attachments = mysqlTable(
  "attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    transactionId: int("transaction_id")
      .notNull()
      .references(() => transactions.id),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    storedName: varchar("stored_name", { length: 80 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    uploadedById: int("uploaded_by_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_txn_idx").on(t.transactionId)],
);

// Gap-free yearly sequences (TXN-2026, RCPT-2026, MEM-2026, ...). Incremented atomically.
export const counters = mysqlTable("counters", {
  name: varchar("name", { length: 40 }).primaryKey(),
  value: int("value").notNull().default(0),
});

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("user_id"),
    userName: varchar("user_name", { length: 120 }),
    action: varchar("action", { length: 40 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 40 }),
    summary: varchar("summary", { length: 255 }).notNull(),
    changes: jsonColumn<Record<string, { from: unknown; to: unknown }> | null>("changes"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_user_idx").on(t.userId),
  ],
);

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  membershipType: one(membershipTypes, {
    fields: [members.membershipTypeId],
    references: [membershipTypes.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  member: one(members, { fields: [transactions.memberId], references: [members.id] }),
  event: one(events, { fields: [transactions.eventId], references: [events.id] }),
  expenseCategory: one(expenseCategories, {
    fields: [transactions.expenseCategoryId],
    references: [expenseCategories.id],
  }),
  createdBy: one(users, { fields: [transactions.createdById], references: [users.id] }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [attachments.transactionId],
    references: [transactions.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  transactions: many(transactions),
}));
