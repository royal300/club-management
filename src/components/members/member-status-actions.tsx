"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/field";
import { deactivateMember, reactivateMember } from "@/server/actions/members";
import type { ActionResult } from "@/lib/validation";

export function DeactivateMemberButton({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const res = await deactivateMember(id, prev, fd);
    if (res?.ok) {
      setOpen(false);
      toast.success(res.message ?? "Member deactivated");
    } else if (res?.message) toast.error(res.message);
    return res;
  }, undefined);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Ban /> Deactivate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Deactivate {name}?</DialogTitle>
            <DialogDescription>
              They&rsquo;ll drop off renewal reminders and dues. Nothing is deleted — their payments and history stay in the ledger, and you can reactivate them any time.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" htmlFor="reason" error={state?.errors?.reason} required>
            <Textarea id="reason" name="reason" rows={2} placeholder="e.g. Moved out of Kolkata" autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep active
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Deactivate member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReactivateMemberButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await reactivateMember(id);
          if (res?.ok) toast.success(res.message ?? "Reactivated");
          else toast.error(res?.message ?? "Could not reactivate");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reactivate
    </Button>
  );
}
