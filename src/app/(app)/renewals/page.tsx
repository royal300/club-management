import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownLeft, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { ExportMenu } from "@/components/app/export-menu";
import { EmptyState } from "@/components/app/empty-state";
import { RenewalBadge } from "@/components/app/badges";
import { ListPageSkeleton } from "@/components/app/skeletons";
import { formatDate, formatINR, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { getRenewalCounts, listRenewals, type MemberRow } from "@/server/queries/members";
import { getClubSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Renewals" };

export default function RenewalsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Renewals />
    </Suspense>
  );
}

async function Renewals() {
  const user = await requireUser();
  const [overdue, due, counts, club] = await Promise.all([listRenewals("overdue"), listRenewals("due"), getRenewalCounts(), getClubSettings()]);
  const today = todayIST();
  const canRecord = can(user.role, "transactions:write");

  return (
    <>
      <PageHeader
        eyebrow="Reminders"
        title="Renewals"
        description={`${counts.overdue} overdue (${formatINR(counts.overdueAmount, { whole: true })}) and ${counts.dueSoon} due in the next 30 days (${formatINR(counts.dueSoonAmount, { whole: true })}).`}
        actions={<ExportMenu entity="renewals" />}
      />
      <div className="space-y-6">
        <RenewalSection id="overdue" title="Overdue" tone="text-destructive" rows={overdue} today={today} canRecord={canRecord} clubName={club.club_name} empty="Nobody is overdue. Lovely." />
        <RenewalSection id="due" title="Due in the next 30 days" tone="text-pending" rows={due} today={today} canRecord={canRecord} clubName={club.club_name} empty="No renewals fall due this month." />
      </div>
    </>
  );
}

function whatsappLink(phone: string, name: string, fee: string, renewal: string, clubName: string, overdue: boolean) {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  const number = digits.length === 10 ? `91${digits}` : digits;
  const text = `Namaskar ${name.split(" ")[0]}, a gentle reminder from ${clubName}: your annual membership fee of ${formatINR(fee, { whole: true })} ${overdue ? "was due on" : "is due on"} ${formatDate(renewal)}. You can pay by UPI or at the club office. Thank you!`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function RenewalSection({ id, title, tone, rows, today, canRecord, clubName, empty }: { id: string; title: string; tone: string; rows: MemberRow[]; today: string; canRecord: boolean; clubName: string; empty: string }) {
  const total = rows.reduce((a, r) => a + Number(r.annualFee), 0);
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
        <h2 className={`font-display text-2xl tracking-tight ${tone}`}>{title}</h2>
        <p className="font-mono text-sm tabular text-muted-foreground">
          {rows.length} · {formatINR(total, { whole: true })}
        </p>
      </div>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Link href={`/members/${m.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate font-medium">{m.fullName}</span>
                <span className="block text-xs text-muted-foreground">
                  <span className="font-mono">{m.memberCode}</span> · {m.typeName} · due {formatDate(m.renewalDate)}
                </span>
              </Link>
              <RenewalBadge renewalDate={m.renewalDate} today={today} />
              <span className="w-20 text-right font-mono text-sm tabular">{formatINR(m.annualFee, { whole: true })}</span>
              <span className="flex gap-1">
                <Button asChild variant="ghost" size="icon" aria-label={`Call ${m.fullName}`}>
                  <a href={`tel:${m.phone.replace(/\s/g, "")}`}>
                    <Phone />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="icon" aria-label={`Send WhatsApp reminder to ${m.fullName}`}>
                  <a href={whatsappLink(m.phone, m.fullName, m.annualFee, m.renewalDate, clubName, m.renewalDate < today)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                  </a>
                </Button>
                {canRecord ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/transactions/new?kind=INCOME&category=SUBSCRIPTION&member=${m.id}`}>
                      <ArrowDownLeft /> Collect
                    </Link>
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState art="members" title={empty} />
      )}
    </section>
  );
}
