import { cn } from "@/lib/utils";
import { formatINR, INCOME_CATEGORY_LABEL, MODE_LABEL } from "@/lib/format";
import type { IncomeCategory, PaymentMode, TxnKind, TxnStatus } from "@/db/schema";
import { Banknote, Landmark, Smartphone } from "lucide-react";

export function Amount({ kind, value, className }: { kind: TxnKind; value: number | string; className?: string }) {
  return (
    <span className={cn("font-mono tabular font-medium whitespace-nowrap", kind === "INCOME" ? "text-income" : "text-expense", className)}>
      {kind === "INCOME" ? "+" : "−"}
      {formatINR(value)}
    </span>
  );
}

const MODE_ICON = { CASH: Banknote, BANK: Landmark, UPI: Smartphone } as const;

export function ModeBadge({ mode }: { mode: PaymentMode }) {
  const Icon = MODE_ICON[mode];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3" />
      {MODE_LABEL[mode]}
    </span>
  );
}

export function StatusBadge({ status }: { status: TxnStatus }) {
  if (status === "COMPLETED") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        status === "PENDING" && "bg-pending/15 text-pending",
        status === "VOID" && "bg-muted text-muted-foreground line-through",
      )}
    >
      {status === "PENDING" ? "Pending" : "Void"}
    </span>
  );
}

export function CategoryLabel({ kind, incomeCategory, expenseCategory }: { kind: TxnKind; incomeCategory?: IncomeCategory | null; expenseCategory?: string | null }) {
  return (
    <span className="text-sm">
      {kind === "INCOME" ? INCOME_CATEGORY_LABEL[incomeCategory ?? "OTHER"] : (expenseCategory ?? "Expense")}
    </span>
  );
}

export function RenewalBadge({ renewalDate, today }: { renewalDate: string; today: string }) {
  const days = Math.round((Date.parse(renewalDate) - Date.parse(today)) / 86_400_000);
  if (days < 0)
    return <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-medium text-destructive">Overdue {-days}d</span>;
  if (days <= 30)
    return <span className="rounded-full bg-pending/15 px-2 py-0.5 text-[11px] font-medium text-pending">Due in {days}d</span>;
  return <span className="rounded-full bg-income/12 px-2 py-0.5 text-[11px] font-medium text-income">Paid up</span>;
}
