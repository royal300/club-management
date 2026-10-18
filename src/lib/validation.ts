import { z } from "zod";
import { EVENT_STATUSES, INCOME_CATEGORIES, PAYMENT_MODES, ROLES, TXN_KINDS } from "@/db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= "1950-01-01";
  }, "Pick a valid date");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/[₹,\s]/g, ""))
  .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees, e.g. 1200 or 1200.50")
  .refine((v) => Number(v) > 0, "Amount must be more than zero")
  .transform((v) => Number(v).toFixed(2));
const optionalMoney = z
  .string()
  .trim()
  .transform((v) => v.replace(/[₹,\s]/g, ""))
  .refine((v) => v === "" || /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees")
  .transform((v) => (v === "" ? null : Number(v).toFixed(2)));
const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : null));

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => /^(\+91)?[6-9]\d{9}$/.test(v) || /^\+?\d{8,15}$/.test(v), "Enter a 10-digit mobile number, e.g. 98300 12345")
  .transform((v) => {
    const digits = v.replace(/^\+91/, "");
    return /^[6-9]\d{9}$/.test(digits) ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : v;
  });

export const MemberSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter the member's full name").max(150),
    phone: phoneSchema,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address")
      .nullable(),
    address: optionalText(500),
    joiningDate: isoDate,
    membershipTypeId: z.coerce.number().int().positive("Choose a membership type"),
    annualFee: money,
    renewalDate: isoDate,
    notes: optionalText(2000),
  })
  .refine((m) => m.renewalDate >= m.joiningDate, { path: ["renewalDate"], message: "Renewal can't be before the joining date" });

export const CollectFeeSchema = z.object({
  collectFee: z.literal("on").optional(),
  feeMode: z.enum(PAYMENT_MODES).optional(),
  feeReference: optionalText(80),
});

export const TransactionSchema = z
  .object({
    kind: z.enum(TXN_KINDS),
    incomeCategory: z.enum(INCOME_CATEGORIES).optional().nullable(),
    expenseCategoryId: optionalId,
    amount: money,
    txnDate: isoDate,
    mode: z.enum(PAYMENT_MODES, { message: "Choose Cash, Bank or UPI" }),
    status: z.enum(["COMPLETED", "PENDING"]).default("COMPLETED"),
    dueDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a valid date"),
    referenceNo: optionalText(80),
    partyName: optionalText(150),
    description: optionalText(1000),
    memberId: optionalId,
    eventId: optionalId,
    extendMembership: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .superRefine((t, ctx) => {
    if (t.kind === "INCOME" && !t.incomeCategory)
      ctx.addIssue({ code: "custom", path: ["incomeCategory"], message: "Choose what this income is for" });
    if (t.kind === "EXPENSE" && !t.expenseCategoryId)
      ctx.addIssue({ code: "custom", path: ["expenseCategoryId"], message: "Choose an expense category" });
    if (t.kind === "INCOME" && t.incomeCategory === "SUBSCRIPTION" && !t.memberId)
      ctx.addIssue({ code: "custom", path: ["memberId"], message: "Pick the member paying this subscription" });
    if (!t.partyName && !t.memberId)
      ctx.addIssue({
        code: "custom",
        path: ["partyName"],
        message: t.kind === "INCOME" ? "Who paid? Enter a name or pick a member" : "Who was paid? Enter the vendor or person",
      });
  });

export const EventSchema = z.object({
  name: z.string().trim().min(2, "Give the event a name").max(150),
  eventDate: isoDate,
  venue: optionalText(190),
  description: optionalText(2000),
  budget: optionalMoney,
  status: z.enum(EVENT_STATUSES),
});

export const UserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(ROLES),
});

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Mix letters and numbers");

export type FieldErrors = Record<string, string>;
export type ActionResult = { ok: boolean; message?: string; errors?: FieldErrors; values?: Record<string, string> } | undefined;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}
