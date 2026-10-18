import { EmptyCalendar, EmptyChairs, EmptyLedger } from "@/components/illustrations";

const ART = { ledger: EmptyLedger, members: EmptyChairs, events: EmptyCalendar };

export function EmptyState({
  art = "ledger",
  title,
  children,
  action,
}: {
  art?: keyof typeof ART;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Art = ART[art];
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <Art className="empty-art mb-4 w-48 max-w-full" />
      <h3 className="font-display text-2xl tracking-tight">{title}</h3>
      {children ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
