"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, FormSection } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import type { ActionResult } from "@/lib/validation";

type Defaults = { name?: string; eventDate?: string; venue?: string | null; description?: string | null; budget?: string | number | null; status?: string };

export function EventForm({ action, defaults, cancelHref, mode }: { action: (p: ActionResult, f: FormData) => Promise<ActionResult>; defaults?: Defaults; cancelHref: string; mode: "create" | "edit" }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.values;
  const e = state?.errors ?? {};
  const val = (k: keyof Defaults) => v?.[k] ?? (defaults?.[k] != null ? String(defaults[k]) : "");
  return (
    <form action={formAction} className="rounded-2xl border bg-card p-5 sm:p-7" noValidate>
      <FormMessage message={state?.message} ok={state?.ok} />
      <FormSection title="The event" description="Link sponsorships, donations and bills to it to see its finances in one place.">
        <Field label="Name" htmlFor="name" error={e.name} required className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={val("name")} placeholder="e.g. Durga Puja 2026" aria-invalid={!!e.name} />
        </Field>
        <Field label="Date" htmlFor="eventDate" error={e.eventDate} required>
          <Input id="eventDate" name="eventDate" type="date" defaultValue={val("eventDate")} aria-invalid={!!e.eventDate} />
        </Field>
        <Field label="Status" htmlFor="status" error={e.status}>
          <NativeSelect id="status" name="status" defaultValue={val("status") || "PLANNED"}>
            <option value="PLANNED">Planned</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </NativeSelect>
        </Field>
        <Field label="Venue" htmlFor="venue" error={e.venue}>
          <Input id="venue" name="venue" defaultValue={val("venue")} />
        </Field>
        <Field label="Budget (₹)" htmlFor="budget" error={e.budget} hint="Optional — the dashboard shows spend against it.">
          <Input id="budget" name="budget" inputMode="decimal" defaultValue={val("budget")} />
        </Field>
        <Field label="Description" htmlFor="description" error={e.description} className="sm:col-span-2">
          <Textarea id="description" name="description" rows={3} defaultValue={val("description")} />
        </Field>
      </FormSection>
      <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "create" ? "Create event" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
