import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { MemberForm } from "@/components/members/member-form";
import { todayIST } from "@/lib/format";
import { createMember } from "@/server/actions/members";
import { requirePermission } from "@/server/auth";
import { listMembershipTypes } from "@/server/queries/members";

export const metadata: Metadata = { title: "Add member" };

export default function NewMemberPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <NewMember />
    </Suspense>
  );
}

async function NewMember() {
  await requirePermission("members:write");
  const types = await listMembershipTypes(true);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Members · New" title="Welcome someone in" description="A member ID is issued automatically when you save." />
      <MemberForm
        action={createMember}
        mode="create"
        today={todayIST()}
        cancelHref="/members"
        types={types.map((t) => ({ id: t.id, name: t.name, annualFee: t.annualFee }))}
      />
    </div>
  );
}
