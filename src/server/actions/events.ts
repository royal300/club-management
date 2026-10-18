"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { EventSchema, flattenErrors, formValues, type ActionResult } from "@/lib/validation";
import { audit, diff } from "@/server/audit";
import { assertPermission, AuthError } from "@/server/auth";
import { nextCode } from "@/server/sequence";

function failure(err: unknown, values?: Record<string, string>): ActionResult {
  if (err instanceof AuthError) return { ok: false, message: err.message, values };
  console.error(err);
  return { ok: false, message: "Something went wrong while saving. Please try again.", values };
}

export async function createEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  let id: number;
  try {
    const user = await assertPermission("events:write");
    const parsed = EventSchema.safeParse(values);
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
    id = await db.transaction(async (tx) => {
      const eventCode = await nextCode(tx, "EVT", parsed.data.eventDate.slice(0, 4), 3);
      const [res] = await tx.insert(events).values({ ...parsed.data, eventCode, createdById: user.id });
      await audit(tx, user, { action: "CREATE", entityType: "event", entityId: res.insertId, summary: `Event ${eventCode} "${parsed.data.name}" created` });
      return res.insertId;
    });
  } catch (err) {
    return failure(err, values);
  }
  redirect(`/events/${id}`);
}

export async function updateEvent(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  try {
    const user = await assertPermission("events:write");
    const parsed = EventSchema.safeParse(values);
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
    const [before] = await db.select().from(events).where(eq(events.id, id));
    if (!before) return { ok: false, message: "That event no longer exists." };
    const changes = diff(before, parsed.data, ["name", "eventDate", "venue", "description", "budget", "status"]);
    if (Object.keys(changes).length) {
      await db.transaction(async (tx) => {
        await tx.update(events).set(parsed.data).where(eq(events.id, id));
        await audit(tx, user, { action: "UPDATE", entityType: "event", entityId: id, summary: `Event ${before.eventCode} updated (${Object.keys(changes).join(", ")})`, changes });
      });
    }
  } catch (err) {
    return failure(err, values);
  }
  redirect(`/events/${id}`);
}
