import { cacheLife } from "next/cache";
import { IntroSequence, INTRO_GATE_SCRIPT } from "@/components/landing/intro-sequence";
import { Landing } from "@/components/landing/landing";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { getClubSettings } from "@/server/settings";

async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export default async function Home() {
  const [club, year] = await Promise.all([getClubSettings(), currentYear()]);
  return (
    <>
      {/* Runs before the intro is parsed so returning visitors never see it flash. */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_GATE_SCRIPT }} />
      <IntroSequence clubName={club.club_name} tagline={club.club_tagline} />
      <SmoothScroll />
      <main>
        <Landing clubName={club.club_name} tagline={club.club_tagline} address={club.club_address} year={year} />
      </main>
    </>
  );
}
