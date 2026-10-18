"use client";

import { useActionState, useEffect, useState } from "react";
import { Ban, CircleCheck, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { addAttachments, settleTransaction, voidTransaction } from "@/server/actions/transactions";
import { formatINR } from "@/lib/format";
import type { ActionResult } from "@/lib/validation";

export function SettleButton({
  id,
  kind,
  amount,
  mode,
  today,
  isSubscription,
}: {
  id: number;
  kind: "INCOME" | "EXPENSE";
  amount: string;
  mode: string;
  today: string;
  isSubscription: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(settleTransaction.bind(null, id), undefined);
  useEffect(() => {
    if (state?.message) toast.error(state.message);
  }, [state]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <CircleCheck /> {kind === "INCOME" ? "Mark received" : "Mark paid"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{kind === "INCOME" ? `Received ${formatINR(amount)}?` : `Paid ${formatINR(amount)}?`}</DialogTitle>
            <DialogDescription>Settling issues the {kind === "INCOME" ? "receipt" : "voucher"} number and adds it to the balance.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="settle-date" error={state?.errors?.txnDate}>
              <Input id="settle-date" name="txnDate" type="date" defaultValue={today} max={today} />
            </Field>
            <Field label="Via" htmlFor="settle-mode">
              <NativeSelect id="settle-mode" name="mode" defaultValue={mode}>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </NativeSelect>
            </Field>
            <Field label="Reference" htmlFor="settle-ref" className="sm:col-span-2">
              <Input id="settle-ref" name="referenceNo" placeholder="UPI / cheque / NEFT reference" />
            </Field>
          </div>
          {isSubscription ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="extendMembership" defaultChecked /> Renew the member&rsquo;s membership by a year
            </label>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Settle &amp; issue {kind === "INCOME" ? "receipt" : "voucher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VoidButton({ id, code }: { id: number; code: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const res = await voidTransaction(id, prev, fd);
    if (res?.ok) {
      setOpen(false);
      toast.success(res.message ?? "Entry voided");
    } else if (res?.message) toast.error(res.message);
    return res;
  }, undefined);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Ban /> Void
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Void {code}?</DialogTitle>
            <DialogDescription>
              Ledgers are never erased. The entry and its number stay on record marked VOID, and it stops counting towards balances and reports.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" htmlFor="void-reason" error={state?.errors?.reason} required>
            <Textarea id="void-reason" name="reason" rows={2} placeholder="e.g. Entered twice by mistake" autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Void entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddAttachments({ id, maxMb }: { id: number; maxMb: number }) {
  const [count, setCount] = useState(0);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const res = await addAttachments(id, prev, fd);
    if (res?.ok) {
      toast.success(res.message ?? "Uploaded");
      setCount(0);
    } else if (res?.message) toast.error(res.message);
    return res;
  }, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-background/60 px-3 text-sm hover:bg-muted">
        <Paperclip className="size-4" />
        {count ? `${count} file${count > 1 ? "s" : ""} chosen` : "Choose files"}
        <input
          key={state?.ok ? "reset" : "input"}
          type="file"
          name="files"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => setCount(e.target.files?.length ?? 0)}
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending || !count}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} Upload
      </Button>
      <span className="text-xs text-muted-foreground">JPG, PNG, WEBP, PDF · {maxMb} MB each</span>
    </form>
  );
}
