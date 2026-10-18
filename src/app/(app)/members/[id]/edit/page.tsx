import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { MemberForm } from "@/components/members/member-form";
import { todayIST } from "@/lib/format";
import { updateMember } from "@/server/actions/members";
import { requirePermission } from "@/server/auth";
import { getMember, listMembershipTypes } from "@/server/queries/members";

export const metadata: Metadata = { title: "Edit member" };

export default function EditMemberPage(props: PageProps<"/members/[id]/edit">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <EditMember params={props.params} />
    </Suspense>
  );
}

async function EditMember({ params }: { params: PageProps<"/members/[id]/edit">["params"] }) {
  await requirePermission("members:write");
  const { id } = await params;
  const member = /^\d+$/.test(id) ? await getMember(Number(id)) : null;
  if (!member) notFound();
  const types = await listMembershipTypes();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={`Members · ${member.memberCode}`} title={`Edit ${member.fullName}`} description="Every change is recorded in the audit log." />
      <MemberForm
        action={updateMember.bind(null, member.id)}
        mode="edit"
        today={todayIST()}
        cancelHref={`/members/${member.id}`}
        types={types.map((t) => ({ id: t.id, name: t.name, annualFee: t.annualFee }))}
        defaults={member}
      />
    </div>
  );
}
