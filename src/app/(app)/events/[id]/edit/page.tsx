import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { EventForm } from "@/components/events/event-form";
import { updateEvent } from "@/server/actions/events";
import { requirePermission } from "@/server/auth";
import { getEvent } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Edit event" };

export default function EditEventPage(props: PageProps<"/events/[id]/edit">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <EditEvent params={props.params} />
    </Suspense>
  );
}

async function EditEvent({ params }: { params: PageProps<"/events/[id]/edit">["params"] }) {
  await requirePermission("events:write");
  const { id } = await params;
  const event = /^\d+$/.test(id) ? await getEvent(Number(id)) : null;
  if (!event) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={`Events · ${event.eventCode}`} title={`Edit ${event.name}`} />
      <EventForm action={updateEvent.bind(null, event.id)} mode="edit" cancelHref={`/events/${event.id}`} defaults={event} />
    </div>
  );
}
