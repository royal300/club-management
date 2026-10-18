"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormMessage, FormSection } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { addYears, formatINR, MODE_LABEL } from "@/lib/format";
import type { ActionResult } from "@/lib/validation";

type TypeOption = { id: number; name: string; annualFee: string };
type MemberDefaults = {
  fullName?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  joiningDate?: string;
  membershipTypeId?: number;
  annualFee?: string;
  renewalDate?: string;
  notes?: string | null;
};

export function MemberForm({
  action,
  types,
  defaults,
  today,
  mode,
  cancelHref,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  types: TypeOption[];
  defaults?: MemberDefaults;
  today: string;
  mode: "create" | "edit";
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.values;
  const e = state?.errors ?? {};
  const initialType = String(v?.membershipTypeId ?? defaults?.membershipTypeId ?? types[0]?.id ?? "");
  const [typeId, setTypeId] = useState(initialType);
  const [fee, setFee] = useState(v?.annualFee ?? defaults?.annualFee ?? types.find((t) => String(t.id) === initialType)?.annualFee ?? "");
  const [joining, setJoining] = useState(v?.joiningDate ?? defaults?.joiningDate ?? today);
  const [renewal, setRenewal] = useState(v?.renewalDate ?? defaults?.renewalDate ?? today);
  const [collect, setCollect] = useState(mode === "create" ? (v ? v.collectFee === "on" : true) : false);

  const val = (k: keyof MemberDefaults) => (v?.[k] as string | undefined) ?? (defaults?.[k] as string | undefined) ?? "";
  const aria = (k: string) => ({ "aria-invalid": !!e[k], "aria-describedby": e[k] ? `${k}-error` : undefined });

  return (
    <form action={formAction} className="rounded-2xl border bg-card p-5 sm:p-7" noValidate>
      <FormMessage message={state?.message} ok={state?.ok} />
      <FormSection title="Who they are" description="Name and contact details as they should appear on receipts.">
        <Field label="Full name" htmlFor="fullName" error={e.fullName} required className="sm:col-span-2">
          <Input id="fullName" name="fullName" defaultValue={val("fullName")} autoComplete="name" {...aria("fullName")} />
        </Field>
        <Field label="Mobile number" htmlFor="phone" error={e.phone} required hint="10-digit Indian mobile number">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={val("phone")} placeholder="98300 12345" autoComplete="tel" {...aria("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" inputMode="email" defaultValue={val("email")} autoComplete="email" {...aria("email")} />
        </Field>
        <Field label="Address" htmlFor="address" error={e.address} className="sm:col-span-2">
          <Textarea id="address" name="address" rows={2} defaultValue={val("address")} autoComplete="street-address" {...aria("address")} />
        </Field>
      </FormSection>

      <FormSection title="Membership" description="The fee and renewal date drive reminders and outstanding dues.">
        <Field label="Membership type" htmlFor="membershipTypeId" error={e.membershipTypeId} required>
          <NativeSelect
            id="membershipTypeId"
            name="membershipTypeId"
            value={typeId}
            onChange={(ev) => {
              setTypeId(ev.target.value);
              const t = types.find((x) => String(x.id) === ev.target.value);
              if (t) setFee(t.annualFee);
            }}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {formatINR(t.annualFee, { whole: true })}/yr
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Annual fee (₹)" htmlFor="annualFee" error={e.annualFee} required hint="Defaults to the type's fee; override for concessions.">
          <Input id="annualFee" name="annualFee" inputMode="decimal" value={fee} onChange={(ev) => setFee(ev.target.value)} {...aria("annualFee")} />
        </Field>
        <Field label="Joining date" htmlFor="joiningDate" error={e.joiningDate} required>
          <Input
            id="joiningDate"
            name="joiningDate"
            type="date"
            value={joining}
            max={today}
            onChange={(ev) => {
              const prev = joining;
              setJoining(ev.target.value);
              if (mode === "create" && renewal === prev) setRenewal(ev.target.value);
            }}
            {...aria("joiningDate")}
          />
        </Field>
        <Field
          label="Next renewal due"
          htmlFor="renewalDate"
          error={e.renewalDate}
          required
          hint={mode === "create" ? "If the fee is collected now, this moves forward a year automatically." : undefined}
        >
          <Input id="renewalDate" name="renewalDate" type="date" value={renewal} onChange={(ev) => setRenewal(ev.target.value)} {...aria("renewalDate")} />
        </Field>
        <Field label="Notes" htmlFor="notes" error={e.notes} className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={2} defaultValue={val("notes")} placeholder="Anything the committee should know" />
        </Field>
      </FormSection>

      {mode === "create" ? (
        <FormSection title="First year's fee" description="Collect it now and a receipt is issued straight away.">
          <label className="flex items-start gap-3 rounded-xl border bg-background/60 p-3.5 sm:col-span-2">
            <Checkbox name="collectFee" checked={collect} onCheckedChange={(c) => setCollect(c === true)} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Collect {fee ? formatINR(fee) : "the annual fee"} now</span>
              <span className="block text-xs text-muted-foreground">
                Renewal will move to {renewal ? addYears(renewal, 1).split("-").reverse().join("/") : "a year later"}.
              </span>
            </span>
          </label>
          {collect ? (
            <>
              <Field label="Paid by" htmlFor="feeMode" error={e.feeMode} required>
                <NativeSelect id="feeMode" name="feeMode" defaultValue={v?.feeMode ?? "UPI"}>
                  {(["UPI", "CASH", "BANK"] as const).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="UPI / bank reference" htmlFor="feeReference" error={e.feeReference}>
                <Input id="feeReference" name="feeReference" defaultValue={v?.feeReference ?? ""} placeholder="Optional" />
              </Field>
            </>
          ) : null}
        </FormSection>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "create" ? "Add member" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
