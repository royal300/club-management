"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Copy, KeyRound, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormMessage } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import {
  addExpenseCategory,
  changeOwnPassword,
  createUser,
  resetUserPassword,
  saveClubSettings,
  saveMembershipType,
  toggleExpenseCategory,
  toggleUserActive,
  updateUserRole,
  type UserActionResult,
} from "@/server/actions/settings";
import { formatDateTime, ROLE_LABEL } from "@/lib/format";
import type { ActionResult } from "@/lib/validation";
import type { ClubSettings } from "@/server/settings";
import type { Role } from "@/db/schema";

function useToastResult(state: ActionResult) {
  useEffect(() => {
    if (!state?.message) return;
    if (state.ok) toast.success(state.message);
    else if (!state.errors) toast.error(state.message);
  }, [state]);
}

/* ---------------------------------------------------------------- Club profile */

export function ClubProfileForm({ initial }: { initial: ClubSettings }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveClubSettings, undefined);
  useToastResult(state);
  const e = state?.errors ?? {};
  const field = (key: keyof ClubSettings, label: string, opts: { wide?: boolean; area?: boolean; hint?: string } = {}) => (
    <Field label={label} htmlFor={key} error={e[key]} hint={opts.hint} className={opts.wide ? "sm:col-span-2" : ""}>
      {opts.area ? <Textarea id={key} name={key} rows={2} defaultValue={state?.values?.[key] ?? initial[key]} /> : <Input id={key} name={key} defaultValue={state?.values?.[key] ?? initial[key]} />}
    </Field>
  );
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {field("club_name", "Club name", { hint: "Shown on the site, in the intro and on every receipt." })}
      {field("club_tagline", "Tagline")}
      {field("club_address", "Address", { wide: true, area: true })}
      {field("club_phone", "Phone")}
      {field("club_email", "Email")}
      {field("club_registration", "Registration details", { wide: true })}
      {field("club_pan", "PAN")}
      {field("receipt_footer", "Receipt footer note", { wide: true, area: true })}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save club profile
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- Membership types */

type TypeRow = { id: number; name: string; annualFee: string; description: string | null; isActive: boolean };

export function MembershipTypeEditor({ row }: { row?: TypeRow }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveMembershipType.bind(null, row?.id ?? null), undefined);
  useToastResult(state);
  const [active, setActive] = useState(row?.isActive ?? true);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="grid items-start gap-2 sm:grid-cols-[1.2fr_0.8fr_1.6fr_auto_auto]">
      <div>
        <Input name="name" defaultValue={row?.name} placeholder="Type name" aria-label="Type name" aria-invalid={!!e.name} />
        {e.name ? <p className="mt-1 text-xs text-destructive">{e.name}</p> : null}
      </div>
      <div>
        <Input name="annualFee" defaultValue={row ? Number(row.annualFee).toFixed(0) : ""} placeholder="Fee ₹" inputMode="decimal" aria-label="Annual fee" aria-invalid={!!e.annualFee} />
        {e.annualFee ? <p className="mt-1 text-xs text-destructive">{e.annualFee}</p> : null}
      </div>
      <Input name="description" defaultValue={row?.description ?? ""} placeholder="Description" aria-label="Description" />
      {row ? (
        <label className="flex h-10 items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
          {active ? <input type="hidden" name="isActive" value="on" /> : null}
          Active
        </label>
      ) : (
        <span />
      )}
      <Button type="submit" variant={row ? "outline" : "default"} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : row ? null : <Plus />} {row ? "Save" : "Add"}
      </Button>
    </form>
  );
}

/* ---------------------------------------------------------------- Expense categories */

export function ExpenseCategories({ rows }: { rows: { id: number; name: string; isActive: boolean }[] }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(addExpenseCategory, undefined);
  useToastResult(state);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {rows.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await toggleExpenseCategory(c.id);
                  if (!r?.ok) toast.error(r?.message ?? "Could not update");
                })
              }
              title={c.isActive ? "Click to hide from new entries" : "Click to restore"}
              className={`h-8 rounded-full border px-3 text-sm transition-colors ${c.isActive ? "bg-background/60 hover:bg-muted" : "border-dashed text-muted-foreground line-through"}`}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
      <form action={action} className="flex max-w-md gap-2">
        <Input name="name" placeholder="New category, e.g. Insurance" aria-label="New category" aria-invalid={!!state?.errors?.name} />
        <Button type="submit" variant="outline" disabled={pending}>
          <Plus /> Add
        </Button>
      </form>
      {state?.errors?.name ? <p className="text-xs text-destructive">{state.errors.name}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Users */

type UserRow = { id: number; name: string; email: string; role: Role; isActive: boolean; lastLoginAt: Date | null };

function PasswordReveal({ result, onClose }: { result: UserActionResult; onClose: () => void }) {
  return (
    <Dialog open={!!result?.password} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this password once</DialogTitle>
          <DialogDescription>
            {result?.message} It won&rsquo;t be shown again. Ask them to change it from <em>My account</em> after signing in.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/50 p-4 font-mono text-sm">
          <p className="text-muted-foreground">{result?.email}</p>
          <p className="mt-1 text-lg font-semibold tracking-wide" data-testid="temp-password">
            {result?.password}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(result?.password ?? "");
              toast.success("Copied");
            }}
          >
            <Copy /> Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPanel({ rows, meId }: { rows: UserRow[]; meId: number }) {
  const [reveal, setReveal] = useState<UserActionResult>(undefined);
  const [created, action, pending] = useActionState<UserActionResult, FormData>(async (prev, fd) => {
    const res = await createUser(prev, fd);
    if (res?.password) setReveal(res);
    else if (res?.message && !res.ok) toast.error(res.message);
    return res;
  }, undefined);
  const [busy, start] = useTransition();
  const e = created?.errors ?? {};
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Person</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Last sign-in</th>
              <th className="px-3 py-2 font-medium">Access</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <td className="px-3 py-2.5">
                  <span className="block font-medium">
                    {u.name} {u.id === meId ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </td>
                <td className="px-3 py-2.5">
                  {u.id === meId ? (
                    ROLE_LABEL[u.role]
                  ) : (
                    <RoleSelect id={u.id} role={u.role} />
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                <td className="px-3 py-2.5">
                  <Switch
                    checked={u.isActive}
                    disabled={u.id === meId || busy}
                    aria-label={u.isActive ? `Disable ${u.name}` : `Enable ${u.name}`}
                    onCheckedChange={() =>
                      start(async () => {
                        const r = await toggleUserActive(u.id);
                        if (r?.ok) toast.success(r.message);
                        else toast.error(r?.message ?? "Could not update");
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const r = await resetUserPassword(u.id);
                        if (r?.password) setReveal(r);
                        else toast.error(r?.message ?? "Could not reset");
                      })
                    }
                  >
                    <KeyRound /> Reset password
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={action} className="grid items-start gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_1.2fr_150px_auto]">
        <div>
          <Input name="name" placeholder="Full name" aria-label="Full name" aria-invalid={!!e.name} />
          {e.name ? <p className="mt-1 text-xs text-destructive">{e.name}</p> : null}
        </div>
        <div>
          <Input name="email" type="email" placeholder="Email" aria-label="Email" aria-invalid={!!e.email} />
          {e.email ? <p className="mt-1 text-xs text-destructive">{e.email}</p> : null}
        </div>
        <NativeSelect name="role" defaultValue="TREASURER" aria-label="Role">
          <option value="ADMIN">Admin</option>
          <option value="TREASURER">Treasurer</option>
          <option value="VIEWER">Viewer</option>
        </NativeSelect>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add user
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        <strong>Admin</strong> manages everything including users and settings · <strong>Treasurer</strong> records members, money and events · <strong>Viewer</strong> can look and export, but not change anything.
      </p>
      <PasswordReveal result={reveal} onClose={() => setReveal(undefined)} />
    </div>
  );
}

function RoleSelect({ id, role }: { id: number; role: Role }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateUserRole.bind(null, id), undefined);
  useToastResult(state);
  return (
    <form action={action}>
      <NativeSelect
        name="role"
        defaultValue={role}
        disabled={pending}
        aria-label="Role"
        className="w-36"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="ADMIN">Admin</option>
        <option value="TREASURER">Treasurer</option>
        <option value="VIEWER">Viewer</option>
      </NativeSelect>
    </form>
  );
}

/* ---------------------------------------------------------------- My account */

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(changeOwnPassword, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="max-w-md space-y-4" key={state?.ok ? "done" : "form"}>
      <FormMessage message={state?.message} ok={state?.ok} />
      <Field label="Current password" htmlFor="current" error={e.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="next" error={e.next} hint="At least 10 characters, with letters and numbers.">
        <Input id="next" name="next" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={e.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Change password
      </Button>
    </form>
  );
}
