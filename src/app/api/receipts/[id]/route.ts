import { getSessionUser } from "@/server/auth";
import { getTransaction } from "@/server/queries/transactions";
import { renderReceiptPdf } from "@/server/receipt-pdf";
import { getClubSettings } from "@/server/settings";

export async function GET(request: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const t = /^\d+$/.test(id) ? await getTransaction(Number(id)) : null;
  if (!t) return Response.json({ error: "Not found" }, { status: 404 });
  if (t.status !== "COMPLETED" || !t.receiptNo) {
    return Response.json({ error: "Receipts are issued once the money has moved." }, { status: 409 });
  }
  const club = await getClubSettings();
  const bytes = await renderReceiptPdf(t, club, process.env.APP_URL ?? new URL(request.url).origin);
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${t.receiptNo}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
