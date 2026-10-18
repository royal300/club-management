import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDownLeft, CircleCheck, FileText, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { ModeBadge, RenewalBadge, StatusBadge } from "@/components/app/badges";
import { HistoryList } from "@/components/app/history-list";
import { EmptyState } from "@/components/app/empty-state";
import { MembershipCard } from "@/components/members/membership-card";
import { DeactivateMemberButton, ReactivateMemberButton } from "@/components/members/member-status-actions";
import { formatDate, formatDateTime, formatINR, INCOME_CATEGORY_LABEL, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { getEntityHistory } from "@/server/queries/finance";
import { getMember, getMemberPayments } from "@/server/queries/members";
import { getClubSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Member" };

export default function MemberPage(props: PageProps<"/members/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Member params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Member({ params, searchParams }: { params: PageProps<"/members/[id]">["params"]; searchParams: PageProps<"/members/[id]">["searchParams"] }) {
  const [user, { id }, sp] = await Promise.all([requireUser(), params, searchParams]);
  const member = /^\d+$/.test(id) ? await getMember(Number(id)) : null;
  if (!member) notFound();
  const [payments, history, club] = await Promise.all([getMemberPayments(member.id), getEntityHistory("member", member.id), getClubSettings()]);
  const today = todayIST();
  const canWrite = can(user.role, "members:write");
  const canRecord = can(user.role, "transactions:write");
  const paid = payments.filter((p) => p.status === "COMPLETED").reduce((a, p) => a + Number(p.amount), 0);
  const inactive = member.status === "INACTIVE";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/members" className="hover:text-foreground">
            ← Members
          </Link>
        }
        title={member.fullName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono">{member.memberCode}</span>·<span>{member.typeName}</span>·
            {inactive ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Inactive</span> : <RenewalBadge renewalDate={member.renewalDate} today={today} />}
          </span>
        }
        actions={
          <>
            {canWrite ? (inactive ? <ReactivateMemberButton id={member.id} /> : <DeactivateMemberButton id={member.id} name={member.fullName} />) : null}
            {canWrite ? (
              <Button asChild variant="outline">
                <Link href={`/members/${member.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            ) : null}
            {canRecord && !inactive ? (
              <Button asChild>
                <Link href={`/transactions/new?kind=INCOME&category=SUBSCRIPTION&member=${member.id}`}>
                  <ArrowDownLeft /> Record payment
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {sp.saved ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-income/30 bg-income/10 px-4 py-3 text-sm text-income">
          <CircleCheck className="size-4" /> Changes saved.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          <div className="py-2">
            <MembershipCard
              clubName={club.club_name}
              name={member.fullName}
              code={member.memberCode}
              type={member.typeName}
              joined={member.joiningDate}
              renewal={member.renewalDate}
              inactive={inactive}
              welcome={!!sp.welcome}
            />
          </div>
          <Panel title="Contact">
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="font-mono hover:underline">
                  {member.phone}
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {member.email ? (
                  <a href={`mailto:${member.email}`} className="break-all hover:underline">
                    {member.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No email</span>
                )}
              </li>
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="whitespace-pre-line">{member.address || <span className="text-muted-foreground">No address</span>}</span>
              </li>
            </ul>
            {member.notes ? <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">{member.notes}</p> : null}
            {inactive ? (
              <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Deactivated {formatDateTime(member.deactivatedAt)} — {member.deactivationReason}
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Fact label="Annual fee" value={formatINR(member.annualFee)} />
            <Fact label="Next renewal" value={formatDate(member.renewalDate)} />
            <Fact label="Paid to date" value={formatINR(paid)} />
          </div>

          <Panel title="Payment history" description="Subscriptions, donations and anything else this member has paid" bodyClassName="p-0 sm:p-0">
            {payments.length ? (
              <ul className="divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Link href={`/transactions/${p.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">{INCOME_CATEGORY_LABEL[p.incomeCategory ?? "OTHER"]}</span>
                        <StatusBadge status={p.status} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(p.txnDate)} · <span className="font-mono">{p.receiptNo ?? p.txnCode}</span>
                        {p.description ? ` · ${p.description}` : ""}
                      </span>
                    </Link>
                    <ModeBadge mode={p.mode} />
                    <span className="w-28 text-right font-mono text-sm tabular">{formatINR(p.amount)}</span>
                    {p.receiptNo ? (
                      <a href={`/api/receipts/${p.id}`} target="_blank" rel="noopener" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Download receipt ${p.receiptNo}`}>
                        <FileText className="size-4" />
                      </a>
                    ) : (
                      <span className="size-8" />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No payments yet">When {member.fullName.split(" ")[0]} pays a subscription or donates, it shows up here with its receipt.</EmptyState>
            )}
          </Panel>

          <Panel title="History">
            <HistoryList entries={history} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
