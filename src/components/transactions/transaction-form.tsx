"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark, Loader2, Paperclip, Search, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormMessage } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { cn } from "@/lib/utils";
import { addYears, formatBytes, formatDate, formatINR, INCOME_CATEGORY_LABEL } from "@/lib/format";
import type { ActionResult } from "@/lib/validation";
import type { IncomeCategory, PaymentMode, TxnKind } from "@/db/schema";

type MemberOpt = { id: number; memberCode: string; fullName: string; annualFee: string; renewalDate: string };
type Defaults = {
  kind: TxnKind;
  incomeCategory?: IncomeCategory | null;
  expenseCategoryId?: number | null;
  amount?: string;
  txnDate: string;
  mode?: PaymentMode;
  status?: "COMPLETED" | "PENDING";
  dueDate?: string | null;
  referenceNo?: string | null;
  partyName?: string | null;
  description?: string | null;
  memberId?: number | null;
  eventId?: number | null;
};

const MODES = [
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "BANK", label: "Bank", icon: Landmark },
] as const;

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function TransactionForm({
  action,
  mode,
  defaults,
  members,
  events,
  expenseCategories,
  today,
  maxMb,
  cancelHref,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  mode: "create" | "edit";
  defaults: Defaults;
  members: MemberOpt[];
  events: { id: number; name: string; eventDate: string }[];
  expenseCategories: { id: number; name: string }[];
  today: string;
  maxMb: number;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.values;
  const e = state?.errors ?? {};

  const [kind, setKind] = useState<TxnKind>((v?.kind as TxnKind) ?? defaults.kind);
  const [category, setCategory] = useState<IncomeCategory>((v?.incomeCategory as IncomeCategory) ?? defaults.incomeCategory ?? "DONATION");
  const [payMode, setPayMode] = useState<PaymentMode>((v?.mode as PaymentMode) ?? defaults.mode ?? "UPI");
  const [status, setStatus] = useState<"COMPLETED" | "PENDING">((v?.status as "COMPLETED" | "PENDING") ?? defaults.status ?? "COMPLETED");
  const [amount, setAmount] = useState(v?.amount ?? defaults.amount ?? "");
  const [party, setParty] = useState(v?.partyName ?? defaults.partyName ?? "");
  const [memberId, setMemberId] = useState<string>(v?.memberId ?? (defaults.memberId ? String(defaults.memberId) : ""));
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const member = members.find((m) => String(m.id) === memberId);
  const income = kind === "INCOME";

  const pickMember = (m: MemberOpt | undefined) => {
    setMemberId(m ? String(m.id) : "");
    if (m) {
      if (!party || members.some((x) => x.fullName === party)) setParty(m.fullName);
      if (income && category === "SUBSCRIPTION" && !amount) setAmount(Number(m.annualFee).toFixed(0));
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ACCEPT.split(",").includes(f.type)) {
        setFileError(`"${f.name}" isn't a JPG, PNG, WEBP or PDF file.`);
        continue;
      }
      if (f.size > maxMb * 1024 * 1024) {
        setFileError(`"${f.name}" is larger than ${maxMb} MB.`);
        continue;
      }
      if (next.length >= 5) {
        setFileError("Attach at most 5 files.");
        break;
      }
      next.push(f);
      setFileError(undefined);
    }
    setFiles(next);
  };

  // Files live in React state; mirror them onto the real input so the form posts them.
  const syncFiles = () => {
    if (!fileInput.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    fileInput.current.files = dt.files;
  };
  useEffect(syncFiles, [files]);

  const tone = income ? "income" : "expense";

  return (
    <form action={formAction} onSubmit={syncFiles} className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="mode" value={payMode} />
      <input type="hidden" name="status" value={status} />
      {income ? <input type="hidden" name="incomeCategory" value={category} /> : null}
      <input type="hidden" name="memberId" value={memberId} />

      <div className="space-y-5 rounded-2xl border bg-card p-5 sm:p-7">
        <FormMessage message={state?.message} ok={state?.ok} />

        {mode === "create" ? (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Type of entry">
            {(["INCOME", "EXPENSE"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150",
                  kind === k ? (k === "INCOME" ? "bg-card text-income shadow-sm" : "bg-card text-expense shadow-sm") : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k === "INCOME" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                {k === "INCOME" ? "Money in" : "Money out"}
              </button>
            ))}
          </div>
        ) : null}

        <div>
          <label htmlFor="amount" className="text-[13px] font-medium">
            Amount<span className="text-destructive"> *</span>
          </label>
          <div className={cn("mt-1.5 flex items-center rounded-xl border-2 bg-background/60 px-4 transition-colors focus-within:border-ring", e.amount ? "border-destructive" : "border-input")}>
            <span className={cn("font-display text-4xl", income ? "text-income" : "text-expense")}>₹</span>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value.replace(/[^\d.,]/g, ""))}
              aria-invalid={!!e.amount}
              aria-describedby={e.amount ? "amount-error" : undefined}
              className="h-16 w-full min-w-0 bg-transparent px-2 text-4xl font-semibold tracking-tight tabular outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          {e.amount ? (
            <p id="amount-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {e.amount}
            </p>
          ) : amount && Number(amount.replace(/,/g, "")) > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{formatINR(amount.replace(/,/g, ""))}</p>
          ) : null}
        </div>

        {income ? (
          <Field label="What is it for?" htmlFor="incomeCategory" error={e.incomeCategory} required group>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="incomeCategory-label">
              {(["DONATION", "SUBSCRIPTION", "SPONSORSHIP", "OTHER"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => {
                    setCategory(c);
                    if (c === "SUBSCRIPTION" && member && !amount) setAmount(Number(member.annualFee).toFixed(0));
                  }}
                  className={cn(
                    "h-10 rounded-full border px-4 text-sm transition-colors duration-150",
                    category === c ? "border-primary bg-primary text-primary-foreground" : "bg-background/60 hover:bg-muted",
                  )}
                >
                  {INCOME_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <Field label="Category" htmlFor="expenseCategoryId" error={e.expenseCategoryId} required>
            <NativeSelect id="expenseCategoryId" name="expenseCategoryId" defaultValue={v?.expenseCategoryId ?? (defaults.expenseCategoryId ? String(defaults.expenseCategoryId) : "")} aria-invalid={!!e.expenseCategoryId}>
              <option value="">Choose a category…</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {income ? (
            <Field label="Member" htmlFor="member-search" error={e.memberId} required={category === "SUBSCRIPTION"} hint={category === "SUBSCRIPTION" ? undefined : "Optional — link a donation to a member"}>
              <MemberPicker members={members} value={member} onChange={pickMember} invalid={!!e.memberId} />
            </Field>
          ) : null}
          <Field label={income ? "Received from" : "Paid to"} htmlFor="partyName" error={e.partyName} required={!member} className={income ? "" : "sm:col-span-2"}>
            <Input id="partyName" name="partyName" value={party} onChange={(ev) => setParty(ev.target.value)} placeholder={income ? "Name of the donor or sponsor" : "Vendor, shop or person"} aria-invalid={!!e.partyName} />
          </Field>
        </div>

        <Field label="Paid via" htmlFor="mode" error={e.mode} required group>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="mode-label">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={payMode === m.value}
                onClick={() => setPayMode(m.value)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors duration-150",
                  payMode === m.value ? "border-primary bg-accent text-accent-foreground ring-2 ring-primary/20" : "bg-background/60 hover:bg-muted",
                )}
              >
                <m.icon className="size-4" /> {m.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="txnDate" error={e.txnDate} required>
            <Input id="txnDate" name="txnDate" type="date" max={today} defaultValue={v?.txnDate ?? defaults.txnDate} aria-invalid={!!e.txnDate} />
          </Field>
          <Field label={payMode === "CASH" ? "Reference (optional)" : payMode === "UPI" ? "UPI transaction ID" : "Cheque / NEFT reference"} htmlFor="referenceNo" error={e.referenceNo}>
            <Input id="referenceNo" name="referenceNo" defaultValue={v?.referenceNo ?? defaults.referenceNo ?? ""} placeholder={payMode === "UPI" ? "e.g. 430912345678" : payMode === "BANK" ? "e.g. NEFT/SBIN…" : "Voucher or slip no."} />
          </Field>
        </div>

        <Field label="Event" htmlFor="eventId" error={e.eventId} hint="Link it to an event to see that event's finances in one place.">
          <NativeSelect id="eventId" name="eventId" defaultValue={v?.eventId ?? (defaults.eventId ? String(defaults.eventId) : "")}>
            <option value="">Not linked to an event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} · {formatDate(ev.eventDate)}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Description" htmlFor="description" error={e.description}>
          <Textarea id="description" name="description" rows={2} defaultValue={v?.description ?? defaults.description ?? ""} placeholder={income ? "e.g. Donation towards Durga Puja bhog" : "e.g. Pandal lighting — final instalment"} />
        </Field>
      </div>

      <aside className="space-y-5">
        {mode === "create" ? (
          <div className="space-y-3 rounded-2xl border bg-card p-5">
            <p className="text-[13px] font-medium">Has the money moved?</p>
            <div className="grid gap-2">
              {(
                [
                  ["COMPLETED", income ? "Yes, received" : "Yes, paid", "A receipt number is issued now."],
                  ["PENDING", income ? "Not yet — a pledge" : "Not yet — a bill to pay", "Tracked under pending payments until settled."],
                ] as const
              ).map(([value, label, help]) => (
                <label key={value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors", status === value ? "border-primary bg-accent/50" : "hover:bg-muted/50")}>
                  <input type="radio" name="status-choice" className="mt-1 accent-[var(--primary)]" checked={status === value} onChange={() => setStatus(value)} />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{help}</span>
                  </span>
                </label>
              ))}
            </div>
            {status === "PENDING" ? (
              <Field label="Due by" htmlFor="dueDate" error={e.dueDate}>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={v?.dueDate ?? defaults.dueDate ?? ""} />
              </Field>
            ) : null}
          </div>
        ) : defaults.status === "PENDING" ? (
          <div className="rounded-2xl border bg-card p-5">
            <Field label="Due by" htmlFor="dueDate" error={e.dueDate}>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={v?.dueDate ?? defaults.dueDate ?? ""} />
            </Field>
          </div>
        ) : null}

        {income && category === "SUBSCRIPTION" && member && status === "COMPLETED" && mode === "create" ? (
          <label className="flex items-start gap-3 rounded-2xl border border-income/30 bg-income/5 p-4">
            <Checkbox name="extendMembership" defaultChecked className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Renew {member.fullName.split(" ")[0]}&rsquo;s membership</span>
              <span className="block text-xs text-muted-foreground">
                Next renewal moves from {formatDate(member.renewalDate)} to {formatDate(addYears(member.renewalDate, 1))}.
              </span>
            </span>
          </label>
        ) : null}

        {mode === "create" ? (
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-[13px] font-medium">Bills, invoices &amp; proofs</p>
            <p className="mb-3 text-xs text-muted-foreground">JPG, PNG, WEBP or PDF · up to {maxMb} MB each · max 5</p>
            <label
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                addFiles(ev.dataTransfer.files);
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-background/50 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-muted/40"
            >
              <Paperclip className="size-5" />
              <span>
                <span className="font-medium text-foreground">Choose files</span> or drop them here
              </span>
              <input
                ref={fileInput}
                type="file"
                name="files"
                multiple
                accept={ACCEPT}
                className="sr-only"
                data-testid="file-input"
                onChange={(ev) => {
                  addFiles(ev.target.files);
                }}
              />
            </label>
            {fileError || e.files ? (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {fileError ?? e.files}
              </p>
            ) : null}
            {files.length ? (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                    <Paperclip className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="rounded p-0.5 hover:bg-background">
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={pending} className={cn("w-full", tone === "expense" && "bg-expense text-white hover:bg-expense/90")}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {mode === "edit" ? "Save changes" : status === "PENDING" ? (income ? "Record pledge" : "Record bill") : income ? "Record income & issue receipt" : "Record expense"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        </div>
      </aside>
    </form>
  );
}

function MemberPicker({ members, value, onChange, invalid }: { members: MemberOpt[]; value?: MemberOpt; onChange: (m: MemberOpt | undefined) => void; invalid?: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => m.fullName.toLowerCase().includes(q) || m.memberCode.toLowerCase().includes(q)) : members;
    return list.slice(0, 8);
  }, [query, members]);

  if (value) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card pl-3 pr-1 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {value.fullName} <span className="font-mono text-xs text-muted-foreground">{value.memberCode}</span>
        </span>
        <button type="button" onClick={() => onChange(undefined)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Clear member">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="member-search"
        role="combobox"
        aria-expanded={open}
        aria-controls="member-results"
        aria-invalid={invalid}
        autoComplete="off"
        value={query}
        placeholder="Search by name or ID"
        onChange={(ev) => {
          setQuery(ev.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (ev.key === "Enter" && open && results[active]) {
            ev.preventDefault();
            onChange(results[active]);
          }
        }}
        className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
      />
      {open && results.length ? (
        <ul id="member-results" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {results.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => {
                ev.preventDefault();
                onChange(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm", i === active && "bg-accent")}
            >
              <span className="truncate">{m.fullName}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{m.memberCode}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
