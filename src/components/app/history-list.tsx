import { formatDateTime } from "@/lib/format";
import type { auditLogs } from "@/db/schema";

type Entry = typeof auditLogs.$inferSelect;

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

/** A compact who-changed-what trail for one record. */
export function HistoryList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-4">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-brass" aria-hidden />
          <p className="text-sm">{e.summary}</p>
          <p className="text-xs text-muted-foreground">
            {e.userName ?? "System"} · {formatDateTime(e.createdAt)}
          </p>
          {e.changes ? (
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {Object.entries(e.changes).map(([field, c]) => (
                <li key={field} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{field}</span>: <span className="line-through">{show(c.from)}</span> → {show(c.to)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
