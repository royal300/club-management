import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { EventForm } from "@/components/events/event-form";
import { todayIST } from "@/lib/format";
import { createEvent } from "@/server/actions/events";
import { requirePermission } from "@/server/auth";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <NewEvent />
    </Suspense>
  );
}

async function NewEvent() {
  await requirePermission("events:write");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Events · New" title="Plan an event" description="An event ID is issued automatically." />
      <EventForm action={createEvent} mode="create" cancelHref="/events" defaults={{ eventDate: todayIST(), status: "PLANNED" }} />
    </div>
  );
}
