import { Suspense } from "react";
import Link from "next/link";
import { ClubMark } from "@/components/illustrations";
import { SidebarLinks, SidebarLinksFallback } from "@/components/app/sidebar-links";
import { MobileNav } from "@/components/app/mobile-nav";
import { GlobalSearch } from "@/components/app/global-search";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { RecordMenu } from "@/components/app/record-menu";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { getRenewalCounts } from "@/server/queries/members";
import { getClubSettings } from "@/server/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const club = await getClubSettings();
  return (
    <div className="paper-grain flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-7 flex items-center gap-2.5 px-3">
          <ClubMark className="size-8 text-sidebar-foreground" />
          <span className="font-display text-xl leading-none tracking-tight">{club.club_name}</span>
        </Link>
        <Suspense fallback={<SidebarLinksFallback />}>
          <SidebarNav />
        </Suspense>
        <div className="mt-auto px-3">
          <p className="font-display text-sm italic leading-snug text-sidebar-foreground/60">&ldquo;{club.club_tagline}&rdquo;</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-6 lg:px-8">
          <Suspense fallback={<div className="size-9 lg:hidden" />}>
            <MobileMenu clubName={club.club_name} />
          </Suspense>
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <ClubMark className="size-7" />
            <span className="font-display text-lg leading-none">{club.club_name}</span>
          </Link>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <Suspense fallback={<div className="h-9 w-40" />}>
              <TopbarActions />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

async function SidebarNav() {
  const user = await requireUser();
  const counts = await getRenewalCounts();
  return <SidebarLinks role={user.role} renewalsDue={counts.overdue + counts.dueSoon} />;
}

async function MobileMenu({ clubName }: { clubName: string }) {
  const user = await requireUser();
  const counts = await getRenewalCounts();
  return <MobileNav role={user.role} clubName={clubName} renewalsDue={counts.overdue + counts.dueSoon} />;
}

async function TopbarActions() {
  const user = await requireUser();
  const canWrite = can(user.role, "transactions:write");
  return (
    <>
      {canWrite ? (
        <>
          <span className="hidden sm:block">
            <RecordMenu />
          </span>
          <span className="sm:hidden">
            <RecordMenu compact />
          </span>
        </>
      ) : null}
      <ThemeToggle />
      <UserMenu user={user} />
    </>
  );
}
