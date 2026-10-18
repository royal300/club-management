import { Suspense } from "react";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { PageHeader, Panel } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { ClubProfileForm, ExpenseCategories, MembershipTypeEditor, UsersPanel } from "@/components/settings/settings-forms";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePermission } from "@/server/auth";
import { listMembershipTypes } from "@/server/queries/members";
import { listExpenseCategories } from "@/server/queries/transactions";
import { getClubSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const me = await requirePermission("settings:write");
  const [club, types, cats, people] = await Promise.all([
    getClubSettings(),
    listMembershipTypes(),
    listExpenseCategories(),
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt })
      .from(users)
      .orderBy(asc(users.name)),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader eyebrow="Admin" title="Settings" description="Club details, fees, categories and who can sign in. Every change is audited." />
      <Panel title="Club profile" description="Used on the public site and printed on receipts.">
        <ClubProfileForm initial={club} />
      </Panel>
      <Panel title="Membership types" description="Changing a fee here affects new members only; existing members keep their own fee.">
        <div className="space-y-3">
          {types.map((t) => (
            <MembershipTypeEditor key={t.id} row={t} />
          ))}
          <div className="border-t pt-3">
            <MembershipTypeEditor />
          </div>
        </div>
      </Panel>
      <Panel title="Expense categories" description="Click a category to hide it from new entries (old entries keep it).">
        <ExpenseCategories rows={cats} />
      </Panel>
      <Panel title="People with access" description="Admins, treasurers and viewers.">
        <UsersPanel rows={people} meId={me.id} />
      </Panel>
    </div>
  );
}
