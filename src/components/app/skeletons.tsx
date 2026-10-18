import { Skeleton } from "@/components/ui/skeleton";

export function HeaderSkeleton() {
  return (
    <div className="mb-8 space-y-3">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-10 w-72 max-w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex gap-2 border-b p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div aria-busy aria-label="Loading">
      <HeaderSkeleton />
      <TableSkeleton />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy aria-label="Loading dashboard">
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-64 rounded-2xl lg:col-span-5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
          <Skeleton className="h-30 rounded-2xl" />
          <Skeleton className="h-30 rounded-2xl" />
          <Skeleton className="h-30 rounded-2xl sm:col-span-2" />
        </div>
        <Skeleton className="h-80 rounded-2xl lg:col-span-8" />
        <Skeleton className="h-80 rounded-2xl lg:col-span-4" />
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
