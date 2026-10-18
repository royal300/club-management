import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const SETTING_KEYS = [
  "club_name",
  "club_tagline",
  "club_address",
  "club_phone",
  "club_email",
  "club_registration",
  "club_pan",
  "receipt_footer",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export type ClubSettings = Record<SettingKey, string>;

export const DEFAULT_SETTINGS: ClubSettings = {
  club_name: "Rasa Club",
  club_tagline: "Every member. Every rupee. One story.",
  club_address: "",
  club_phone: "",
  club_email: "",
  club_registration: "",
  club_pan: "",
  receipt_footer: "Thank you for supporting the club. This is a computer-generated receipt.",
};

/** Club profile. Cached across requests; invalidated with updateTag("settings"). */
export async function getClubSettings(): Promise<ClubSettings> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  try {
    const rows = await db.select().from(settings);
    const out = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if ((SETTING_KEYS as readonly string[]).includes(row.key)) out[row.key as SettingKey] = row.value;
    }
    return out;
  } catch (err) {
    console.error("[settings] falling back to defaults:", (err as Error).message);
    return DEFAULT_SETTINGS;
  }
}
