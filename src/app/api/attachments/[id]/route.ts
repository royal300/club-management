import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { getSessionUser } from "@/server/auth";
import { readStoredFile } from "@/server/uploads";

export async function GET(_request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const [a] = await db.select().from(attachments).where(eq(attachments.id, Number(id)));
  if (!a) return Response.json({ error: "Not found" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = await readStoredFile(a.storedName);
  } catch {
    return Response.json({ error: "File missing from storage" }, { status: 410 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.originalName)}`,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
