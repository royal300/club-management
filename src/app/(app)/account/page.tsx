import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { ChangePasswordForm } from "@/components/settings/settings-forms";
import { ROLE_LABEL } from "@/lib/format";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const me = await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader eyebrow="You" title="My account" description={`${me.name} · ${me.email} · ${ROLE_LABEL[me.role]}`} />
      <Panel title="Change password" description="Changing it signs you out everywhere else.">
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}
