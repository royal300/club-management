import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { Pagination } from "@/components/app/pagination";
import { ExportMenu } from "@/components/app/export-menu";
import { EmptyState } from "@/components/app/empty-state";
import { RenewalBadge } from "@/components/app/badges";
import { ListPageSkeleton } from "@/components/app/skeletons";
import { formatDate, formatINR, formatNumber, initials, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { listMembers, listMembershipTypes, parseMemberFilters } from "@/server/queries/members";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage(props: PageProps<"/members">) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Members searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Members({ searchParams }: { searchParams: PageProps<"/members">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const filters = parseMemberFilters(sp);
  const [page, types] = await Promise.all([listMembers(filters), listMembershipTypes()]);
  const today = todayIST();
  const canWrite = can(user.role, "members:write");

  return (
    <>
      <PageHeader
        eyebrow="The register"
        title="Members"
        description={`${formatNumber(page.total)} ${filters.status === "INACTIVE" ? "inactive" : filters.status ? "active" : ""} members on the books.`}
        actions={
          <>
            <ExportMenu entity="members" />
            {canWrite ? (
              <Button asChild>
                <Link href="/members/new">
                  <UserPlus /> Add member
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="rounded-2xl border bg-card">
        <div className="border-b p-3 sm:p-4">
          <FilterBar
            placeholder="Name, member ID, phone…"
            filters={[
              {
                type: "select",
                name: "status",
                label: "Status",
                allLabel: "Active",
                options: [
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "all", label: "All statuses" },
                ],
              },
              { type: "select", name: "type", label: "Types", options: types.map((t) => ({ value: String(t.id), label: t.name })) },
              {
                type: "select",
                name: "renewal",
                label: "Renewal",
                allLabel: "Any renewal",
                options: [
                  { value: "overdue", label: "Overdue" },
                  { value: "due", label: "Due in 30 days" },
                  { value: "current", label: "Paid up" },
                ],
              },
              {
                type: "select",
                name: "sort",
                label: "Sort",
                allLabel: "Sort: name",
                options: [
                  { value: "code", label: "Sort: member ID" },
                  { value: "joined", label: "Sort: newest" },
                  { value: "renewal", label: "Sort: renewal date" },
                ],
              },
              { type: "date", name: "from", label: "Joined from" },
              { type: "date", name: "to", label: "to" },
            ]}
          />
        </div>
        {page.rows.length ? (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-3 py-3 font-medium">Renewal</th>
                  <th className="px-5 py-3 text-right font-medium">Annual fee</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.rows.map((m) => (
                  <tr key={m.id} className="group relative transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/members/${m.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground">
                          {initials(m.fullName)}
                        </span>
                        <span>
                          <span className="block font-medium">{m.fullName}</span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {m.memberCode}
                            {m.status === "INACTIVE" ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans">Inactive</span> : null}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{m.phone}</td>
                    <td className="px-3 py-3">{m.typeName}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatDate(m.joiningDate)}</td>
                    <td className="px-3 py-3">
                      <span className="flex flex-col items-start gap-1">
                        <span className="whitespace-nowrap">{formatDate(m.renewalDate)}</span>
                        {m.status === "ACTIVE" ? <RenewalBadge renewalDate={m.renewalDate} today={today} /> : null}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular">{formatINR(m.annualFee, { whole: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y md:hidden">
              {page.rows.map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted/50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground">
                      {initials(m.fullName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.fullName}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {m.memberCode} · {m.phone}
                      </span>
                    </span>
                    {m.status === "ACTIVE" ? <RenewalBadge renewalDate={m.renewalDate} today={today} /> : <span className="text-xs text-muted-foreground">Inactive</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination base="/members" sp={sp} page={page.page} pages={page.pages} total={page.total} pageSize={page.pageSize} />
          </>
        ) : (
          <EmptyState
            art="members"
            title={filters.q || filters.renewal || filters.typeId ? "No one matches that" : "No members yet"}
            action={
              canWrite && !filters.q ? (
                <Button asChild>
                  <Link href="/members/new">
                    <UserPlus /> Add the first member
                  </Link>
                </Button>
              ) : null
            }
          >
            {filters.q ? `Nobody's name, ID or phone matches "${filters.q}".` : "Every club starts with one member. Add yours to begin the register."}
          </EmptyState>
        )}
      </div>
    </>
  );
}
