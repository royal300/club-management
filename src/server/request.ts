import "server-only";
import { headers } from "next/headers";

/** Client IP as seen through the Nginx reverse proxy. */
export async function clientIp() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return (h.get("x-real-ip") ?? "unknown").slice(0, 64);
}

export async function userAgent() {
  const h = await headers();
  return (h.get("user-agent") ?? "").slice(0, 255);
}
