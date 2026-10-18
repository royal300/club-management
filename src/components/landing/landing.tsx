"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowDown, ArrowRight, BellRing, Check, FileSpreadsheet, History, Paperclip, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { Bunting, ClubMark, Coin, EventCalendar, Ledger, Members, ReceiptPaper } from "@/components/illustrations";
import { ProximityText } from "./proximity-text";
import { VantaFog } from "./vanta-fog";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function Chars({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-hidden>
      {text.split(" ").map((word, wi, arr) => (
        <span key={wi} className="inline-block whitespace-nowrap" aria-hidden>
          {word.split("").map((ch, i) => (
            <span key={i} className="hero-char inline-block">
              {ch}
            </span>
          ))}
          {wi < arr.length - 1 ? <span className="hero-char inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}

const MEMBER_CARDS = [
  { name: "Arindam Banerjee", code: "MEM-2019-0007", type: "Family", tone: "bg-felt text-paper" },
  { name: "Moumita Ghosh", code: "MEM-2021-0012", type: "Ordinary", tone: "bg-brass text-ink" },
  { name: "Sayan Mukherjee", code: "MEM-2024-0031", type: "Student", tone: "bg-stamp text-paper" },
  { name: "Tanushree Sen", code: "MEM-2016-0002", type: "Patron", tone: "bg-paper text-ink" },
  { name: "Kaushik Dutta", code: "MEM-2026-0042", type: "Ordinary", tone: "bg-felt-deep text-paper" },
];

const JARS = [
  { mode: "Cash", amount: 34744, height: 0.32 },
  { mode: "Bank", amount: 467369, height: 0.92 },
  { mode: "UPI", amount: 194884, height: 0.6 },
];

const EVENTS = [
  { name: "Durga Puja", date: "17 Oct", raised: 572999, spent: 515960, tone: "bg-stamp text-paper" },
  { name: "Annual Sports Meet", date: "11 Jan", raised: 86400, spent: 71250, tone: "bg-felt text-paper" },
  { name: "Saraswati Puja", date: "23 Jan", raised: 61820, spent: 49310, tone: "bg-brass text-ink" },
  { name: "Rabindra Jayanti", date: "09 May", raised: 55358, spent: 36430, tone: "bg-felt-deep text-paper" },
  { name: "Blood Donation Camp", date: "14 Jun", raised: 76124, spent: 27730, tone: "bg-stamp text-paper" },
];

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;

export function Landing({ clubName, tagline, address, year }: { clubName: string; tagline: string; address: string; year: number }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      /* ---------- Hero: kinetic headline once the curtain lifts ---------- */
      // `full`: the intro just lifted, so everything can make an entrance. Returning visitors
      // already see the page painted, so only the (CSS pre-hidden) headline rises — no flicker.
      const heroIn = (full: boolean) => {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        // The CSS pre-hide (translateY(115%)) is read by GSAP as a pixel `y`; zero it explicitly,
        // and cancel the CSS failsafe now that JS is driving.
        gsap.set(".hero-char", { animation: "none" });
        tl.fromTo(".hero-char", { y: 0, yPercent: 115, rotate: 6 }, { y: 0, yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.022 });
        if (full) {
          tl.from(".hero-fade", { y: 24, opacity: 0, duration: 0.8, stagger: 0.08 }, "-=0.7")
            .from(".hero-coin", { scale: 0, rotate: -120, duration: 1, stagger: 0.08, ease: "back.out(1.8)" }, "-=0.9")
            .from(".hero-bunting [data-part='flag']", { scaleY: 0, transformOrigin: "50% 0%", duration: 0.5, stagger: 0.04, ease: "back.out(2)" }, "-=1");
        }
      };

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (document.documentElement.dataset.intro === "play") window.addEventListener("intro:done", () => heroIn(true), { once: true });
        else heroIn(false);

        // Coins drift and react to scroll.
        gsap.utils.toArray<HTMLElement>(".hero-coin").forEach((coin, i) => {
          gsap.to(coin, { y: "+=14", rotate: i % 2 ? 8 : -8, duration: 2.6 + i * 0.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
          gsap.to(coin, { yPercent: -120 - i * 40, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
        });
        gsap.to(".hero-title", { yPercent: 18, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

        /* ---------- Velocity marquee ---------- */
        const rows = gsap.utils.toArray<HTMLElement>(".marquee-row");
        // Each row holds two copies of its words, so shifting by half its width loops seamlessly.
        const loops = rows.map((row, i) =>
          gsap.fromTo(row, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration: 28, ease: "none", repeat: -1 }),
        );
        ScrollTrigger.create({
          trigger: ".marquee",
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const boost = 1 + Math.min(4, Math.abs(self.getVelocity()) / 400);
            loops.forEach((l) => gsap.to(l, { timeScale: boost, duration: 0.3, overwrite: true }));
          },
        });

        /* ---------- Section headings slide up as they enter ---------- */
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
          gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } });
        });
      });

      /* ---------- Chapter I: members (pinned on desktop) ---------- */
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>(".member-card");
        const tl = gsap.timeline({
          scrollTrigger: { trigger: ".ch-members", start: "top top", end: "+=160%", scrub: 0.8, pin: true, anticipatePin: 1 },
        });
        tl.from(".ch-members .members-illo", { y: 80, autoAlpha: 0, duration: 0.6 })
          .from(cards, { y: 300, rotate: (i) => (i - 2) * 4, opacity: 0, stagger: 0.12, duration: 0.6 }, 0.2)
          .to(cards, { x: (i) => (i - 2) * 92, rotate: (i) => (i - 2) * 9, y: (i) => Math.abs(i - 2) * 18, duration: 1, ease: "power2.inOut" }, ">")
          .to({ n: 1 }, {
            n: 42,
            duration: 1,
            ease: "none",
            onUpdate() {
              const el = document.querySelector(".member-count");
              if (el) el.textContent = String(Math.round(this.targets()[0].n)).padStart(4, "0");
            },
          }, "<")
          .from(".renew-stamp", { scale: 3, autoAlpha: 0, rotate: -40, duration: 0.3, ease: "back.out(3)" }, ">-0.1")
          .to(".renew-bell", { rotate: 18, duration: 0.08, repeat: 7, yoyo: true, ease: "sine.inOut" }, "<")
          .from(".ch-members .feature-line", { x: -30, opacity: 0, stagger: 0.1, duration: 0.4 }, 0.3);

        /* ---------- Chapter II: rupees fall into cash, bank, UPI ---------- */
        const money = gsap.timeline({
          scrollTrigger: { trigger: ".ch-money", start: "top top", end: "+=170%", scrub: 0.8, pin: true, anticipatePin: 1 },
        });
        money
          .from(".ch-money .ledger-illo", { rotateX: 60, y: 120, autoAlpha: 0, duration: 0.6 })
          .from(".falling-coin", { y: -520, rotate: () => gsap.utils.random(-260, 260), autoAlpha: 0, stagger: 0.07, duration: 0.7, ease: "power2.in" }, 0.2)
          .to(".falling-coin", { autoAlpha: 0, duration: 0.15, stagger: 0.07 }, "-=0.55")
          .fromTo(".jar-fill", { scaleY: 0 }, { scaleY: (i, el) => Number((el as HTMLElement).dataset.h), duration: 1, ease: "power1.out" }, 0.45);
        gsap.utils.toArray<HTMLElement>(".jar-amount").forEach((el) => {
          const to = Number(el.dataset.to);
          money.to({ v: 0 }, { v: to, duration: 1, ease: "power1.out", onUpdate() { el.textContent = inr(this.targets()[0].v); } }, 0.45);
        });
        money
          .to(".money-words", { yPercent: -25, duration: 0.25, ease: "power2.inOut" }, 0.35)
          .to(".money-words", { yPercent: -50, duration: 0.25, ease: "power2.inOut" }, 0.75)
          .to(".money-words", { yPercent: -75, duration: 0.25, ease: "power2.inOut" }, 1.15);

        /* ---------- Chapter III: a horizontal walk through the year's events ---------- */
        const track = document.querySelector<HTMLElement>(".events-track");
        if (track) {
          gsap.to(track, {
            x: () => -(track.scrollWidth - window.innerWidth + 64),
            ease: "none",
            scrollTrigger: { trigger: ".ch-events", start: "top top", end: () => `+=${track.scrollWidth}`, scrub: 0.6, pin: true, invalidateOnRefresh: true, anticipatePin: 1 },
          });
        }

        /* ---------- The receipt prints itself ---------- */
        const r = gsap.timeline({ scrollTrigger: { trigger: ".ch-receipt", start: "top top", end: "+=120%", scrub: 0.6, pin: true } });
        r.fromTo(".receipt-paper", { yPercent: -100 }, { yPercent: 0, duration: 1, ease: "none" })
          .from(".receipt-paper [data-part='stamp']", { scale: 3.2, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.25, ease: "back.out(3)" })
          .from(".receipt-copy > *", { y: 40, opacity: 0, stagger: 0.1, duration: 0.4 }, 0);
      });

      /* Small screens: no pinning, just gentle reveals. */
      mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.from(".member-card", { y: 60, opacity: 0, stagger: 0.08, scrollTrigger: { trigger: ".ch-members .card-stage", start: "top 80%" } });
        gsap.fromTo(".jar-fill", { scaleY: 0 }, { scaleY: (i, el) => Number((el as HTMLElement).dataset.h), duration: 1.2, ease: "power2.out", scrollTrigger: { trigger: ".jars", start: "top 80%" } });
        gsap.fromTo(".receipt-paper", { yPercent: -60 }, { yPercent: 0, duration: 1.4, ease: "power2.out", scrollTrigger: { trigger: ".ch-receipt", start: "top 70%" } });
      });

      /* Feature cards and closing line, everywhere. */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".feature-card", { y: 50, opacity: 0, stagger: 0.08, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: ".features", start: "top 75%" } });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="overflow-x-clip bg-felt-deep text-paper">
      {/* ================================================================ HERO */}
      <section className="hero paper-grain relative flex min-h-[100svh] flex-col overflow-hidden">
        <VantaFog className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(195,145,47,0.28),transparent_60%)]" />
        <Bunting className="hero-bunting pointer-events-none absolute inset-x-0 top-0 h-16 w-full opacity-90 sm:h-20" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 pt-20 sm:px-8 sm:pt-24">
          <Link href="/" className="hero-fade flex items-center gap-2.5">
            <ClubMark className="size-8 text-paper" />
            <span className="font-display text-xl">{clubName}</span>
          </Link>
          <nav className="hero-fade hidden items-center gap-7 text-sm text-paper/70 md:flex" aria-label="Story">
            <a href="#members" className="hover:text-paper">Members</a>
            <a href="#money" className="hover:text-paper">Money</a>
            <a href="#events" className="hover:text-paper">Events</a>
            <a href="#receipts" className="hover:text-paper">Receipts</a>
          </nav>
          <Link href="/login" className="hero-fade inline-flex h-10 items-center gap-2 rounded-full bg-brass px-5 text-sm font-medium text-ink transition-transform hover:scale-[1.03]">
            Sign in <ArrowRight className="size-4" />
          </Link>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
          <p className="hero-fade mb-6 font-mono text-[11px] uppercase tracking-[0.35em] text-brass-soft/80">The members&rsquo; ledger of {clubName}</p>
          <h1 aria-label="Every member. Every rupee. One story." className="hero-title font-display text-[clamp(3.3rem,11.5vw,10.5rem)] leading-[0.86] tracking-[-0.035em]">
            <span className="-mb-[0.16em] block overflow-hidden pb-[0.2em]">
              <Chars text="Every member." />
            </span>
            <span className="-mb-[0.16em] block overflow-hidden pb-[0.2em] pl-[0.6em]">
              <Chars text="Every rupee." className="font-display-wonk italic text-brass-soft" />
            </span>
            <span className="-mb-[0.12em] block overflow-hidden pb-[0.2em]">
              <Chars text="One story" />
              <span className="hero-char inline-block text-stamp">.</span>
            </span>
          </h1>
          <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p className="hero-fade max-w-md text-lg text-paper/75 text-pretty">
              Subscriptions and donations, sponsorships and bills, members and events — kept in one honest ledger, with a receipt for every rupee.
            </p>
            <div className="hero-fade flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 font-medium text-ink transition-transform hover:scale-[1.03]">
                Enter the clubhouse <ArrowRight className="size-4" />
              </Link>
              <a href="#members" className="inline-flex h-12 items-center gap-2 rounded-full border border-paper/25 px-6 text-paper/90 transition-colors hover:bg-paper/10">
                Read the story <ArrowDown className="size-4" />
              </a>
            </div>
          </div>
        </div>
        <Coin className="hero-coin absolute right-[8%] top-[22%] hidden w-20 md:block" size={84} />
        <Coin className="hero-coin absolute right-[22%] top-[58%] hidden w-14 md:block" size={56} />
        <Coin className="hero-coin absolute left-[60%] top-[14%] hidden w-10 lg:block" size={40} />
        <div className="hero-fade relative z-10 mx-auto mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          <span className="block h-8 w-px animate-pulse bg-paper/40" /> Scroll to turn the page
        </div>
      </section>

      {/* ================================================================ MARQUEE */}
      <section aria-hidden className="marquee relative -rotate-1 overflow-hidden border-y-2 border-ink bg-brass py-4 text-ink">
        {[0, 1].map((r) => (
          <div key={r} className="marquee-row flex w-max gap-10 whitespace-nowrap font-display text-[clamp(1.6rem,4vw,3rem)] italic leading-tight">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["Members", "Subscriptions", "Donations", "Sponsorships", "Events", "Receipts", "Cash · Bank · UPI", "Audit trail"].map((w) => (
                <span key={`${k}-${w}`} className="flex items-center gap-10">
                  {w} <span className="not-italic text-stamp">✦</span>
                </span>
              )),
            )}
          </div>
        ))}
      </section>

      {/* ================================================================ CHAPTER I — MEMBERS */}
      <section id="members" className="ch-members relative bg-paper text-ink">
        <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:py-0">
          <div>
            <p className="reveal font-mono text-xs uppercase tracking-[0.3em] text-stamp">Chapter I</p>
            <h2 className="reveal mt-3 font-display text-[clamp(3rem,8vw,7rem)] leading-[0.9] tracking-tight">
              Every <em className="font-display-wonk text-felt">member</em>.
            </h2>
            <p className="reveal mt-6 max-w-md text-lg text-ink/70 text-pretty">
              Each person who walks through the door gets a member ID, a card and a page in the register — with their fee, their renewal date and every rupee they&rsquo;ve ever paid.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Member IDs issued automatically, never reused",
                "Renewal reminders before anyone falls behind",
                "Deactivate without deleting — history stays",
              ].map((t) => (
                <li key={t} className="feature-line flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full bg-felt text-paper">
                    <Check className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-stage relative h-[420px] sm:h-[480px]">
            <Members className="members-illo absolute inset-x-0 top-0 mx-auto w-[min(100%,420px)] opacity-90" />
            <div className="absolute inset-x-0 bottom-0 flex h-[230px] items-end justify-center">
              {MEMBER_CARDS.map((c, i) => (
                <div
                  key={c.code}
                  className={`member-card absolute bottom-6 w-[210px] rounded-xl border-2 border-ink p-3.5 shadow-[6px_6px_0_var(--ink)] ${c.tone}`}
                  style={{ zIndex: i === 2 ? 10 : 5 - Math.abs(i - 2) }}
                >
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] opacity-70">{clubName} · Member</p>
                  <p className="mt-2 font-display text-xl leading-tight">{c.name}</p>
                  <p className="font-mono text-xs font-semibold">{c.code}</p>
                  <p className="mt-3 text-[11px] opacity-75">{c.type} · renews every year</p>
                  {i === 2 ? (
                    <span className="renew-stamp absolute -right-3 -top-4 rotate-[-14deg] rounded-md border-[3px] border-stamp bg-paper/90 px-2 py-0.5 font-mono text-xs font-extrabold tracking-[0.2em] text-stamp">
                      RENEWED
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="absolute right-0 top-4 flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--ink)]">
              <BellRing className="renew-bell size-4 text-stamp" />
              <span className="font-mono text-xs">
                MEM-2026-<span className="member-count">0042</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ CHAPTER II — MONEY */}
      <section id="money" className="ch-money paper-grain relative bg-felt text-paper">
        <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:py-0">
          <div>
            <p className="reveal font-mono text-xs uppercase tracking-[0.3em] text-brass-soft">Chapter II</p>
            <h2 className="reveal mt-3 font-display text-[clamp(3rem,8vw,7rem)] leading-[0.9] tracking-tight">
              Every <em className="font-display-wonk text-brass-soft">rupee</em>.
            </h2>
            <p className="reveal mt-6 max-w-md text-lg text-paper/70 text-pretty">
              Whether it arrives as a{" "}
              <span className="relative inline-flex h-[1.4em] overflow-hidden align-bottom">
                <span className="money-words flex flex-col">
                  {["donation", "subscription", "sponsorship", "donation"].map((w, i) => (
                    <span key={i} className="block h-[1.4em] font-medium text-brass-soft">
                      {w}
                    </span>
                  ))}
                </span>
              </span>{" "}
              or leaves as a bill, it lands in the right pocket — cash in hand, the bank, or UPI — and the balance of each is always one glance away.
            </p>
            <p className="reveal mt-6 font-mono text-xs text-paper/50">TXN-2026-000123 · RCPT-2026-000123 · numbered, never skipped</p>
          </div>
          <div className="relative">
            <Ledger className="ledger-illo mx-auto w-[min(100%,460px)]" />
            <div className="jars mt-6 grid grid-cols-3 gap-4 sm:gap-6">
              {JARS.map((j, i) => (
                <div key={j.mode} className="relative flex flex-col items-center">
                  {[0, 1, 2].map((k) => (
                    <Coin key={k} size={34} className="falling-coin absolute -top-8 z-10" style={{ left: `${30 + k * 14}%` }} />
                  ))}
                  <div className="relative h-36 w-full overflow-hidden rounded-b-2xl rounded-t-md border-2 border-paper/80 bg-felt-deep/60 sm:h-44">
                    <div
                      className="jar-fill absolute inset-x-0 bottom-0 h-full origin-bottom bg-[repeating-linear-gradient(0deg,var(--brass)_0_10px,var(--brass-soft)_10px_12px)]"
                      data-h={j.height}
                      style={{ transform: `scaleY(${j.height})`, opacity: 0.9 - i * 0.08 }}
                    />
                  </div>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.25em] text-paper/60">{j.mode}</p>
                  <p className="jar-amount font-mono text-sm font-semibold sm:text-base" data-to={j.amount}>
                    {inr(j.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ CHAPTER III — EVENTS */}
      <section id="events" className="ch-events relative overflow-hidden bg-paper text-ink">
        <div className="events-track flex min-h-[100svh] items-center gap-6 px-5 py-24 sm:px-8 lg:w-max lg:flex-nowrap lg:py-0 max-lg:flex-col max-lg:items-stretch">
          <div className="shrink-0 lg:w-[40vw] lg:pr-10">
            <p className="reveal font-mono text-xs uppercase tracking-[0.3em] text-stamp">Chapter III</p>
            <h2 className="reveal mt-3 font-display text-[clamp(3rem,8vw,7rem)] leading-[0.9] tracking-tight">
              One <em className="font-display-wonk text-stamp">story</em>.
            </h2>
            <p className="reveal mt-6 max-w-md text-lg text-ink/70 text-pretty">
              Every puja, meet and camp keeps its own account: what was pledged, what came in, what it cost and what was left for the next one.
            </p>
            <EventCalendar className="reveal mt-8 hidden w-40 lg:block" />
          </div>
          {EVENTS.map((e) => {
            const net = e.raised - e.spent;
            return (
              <article key={e.name} className="event-card relative w-full shrink-0 overflow-hidden rounded-3xl border-2 border-ink bg-paper shadow-[8px_8px_0_var(--ink)] lg:w-[380px]">
                <div className={`${e.tone} relative h-40 overflow-hidden`}>
                  <Bunting className="absolute inset-x-0 top-0 h-12 w-full" />
                  <span className="absolute bottom-3 left-5 font-display text-5xl">{e.date}</span>
                </div>
                <div className="space-y-4 p-6">
                  <h3 className="font-display text-3xl leading-tight">{e.name}</h3>
                  <dl className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div>
                      <dt className="text-ink/70">Raised</dt>
                      <dd className="font-semibold">{inr(e.raised)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink/70">Spent</dt>
                      <dd className="font-semibold">{inr(e.spent)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink/70">Left</dt>
                      <dd className="font-semibold text-felt">{inr(net)}</dd>
                    </div>
                  </dl>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-felt" style={{ width: `${Math.round((e.spent / e.raised) * 100)}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
          <div className="w-8 shrink-0 max-lg:hidden" />
        </div>
      </section>

      {/* ================================================================ RECEIPT */}
      <section id="receipts" className="ch-receipt paper-grain relative overflow-hidden bg-felt-deep text-paper">
        <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:py-0">
          <div className="receipt-copy space-y-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass-soft">The receipt</p>
            <h2 className="font-display text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[0.92] tracking-tight">
              A receipt for <em className="font-display-wonk text-brass-soft">every</em> rupee.
            </h2>
            <p className="max-w-md text-lg text-paper/70 text-pretty">
              The moment money moves, a numbered receipt is issued — amount in words, mode, reference and the club&rsquo;s seal — ready to download as a PDF or send on WhatsApp.
            </p>
            <p className="font-mono text-sm text-brass-soft">RCPT-2026-000123 → Twelve Thousand Five Hundred Rupees Only</p>
          </div>
          <div className="relative mx-auto w-[min(86vw,340px)]">
            <div className="relative z-10 h-14 rounded-2xl border-2 border-paper/70 bg-felt shadow-xl">
              <div className="absolute inset-x-6 bottom-3 h-2 rounded-full bg-black/50" />
            </div>
            <div className="-mt-3 overflow-hidden px-5">
              <ReceiptPaper className="receipt-paper w-full drop-shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ FEATURES */}
      <section className="features bg-paper px-5 py-24 text-ink sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="reveal max-w-3xl font-display text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[0.95] tracking-tight">
            Calm on the inside, where the <em className="font-display-wonk text-felt">real work</em> happens.
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Wallet, title: "Cash, Bank & UPI", body: "Separate balances for every pocket, totals that always add up." },
              { icon: Paperclip, title: "Bills & proofs", body: "Photograph a bill or attach a PDF — stored privately, beside its entry." },
              { icon: History, title: "Audit trail", body: "Who changed what and when, with the before and after of every edit." },
              { icon: ShieldCheck, title: "Roles that fit", body: "Admins, treasurers and viewers each see exactly what they should." },
              { icon: FileSpreadsheet, title: "Excel & CSV", body: "Every list exports with your filters, in proper ₹ lakh formatting." },
              { icon: Smartphone, title: "In your pocket", body: "Record a donation at the pandal gate from any phone." },
            ].map((f) => (
              <div key={f.title} className="feature-card group rounded-3xl border-2 border-ink/80 bg-card p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink)]">
                <span className="grid size-12 place-items-center rounded-2xl bg-felt text-paper transition-transform duration-300 group-hover:rotate-[-8deg]">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-2xl">{f.title}</h3>
                <p className="mt-2 text-ink/65">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ CLOSING */}
      <section className="paper-grain relative overflow-hidden bg-felt px-5 py-28 text-center sm:px-8 sm:py-40">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass-soft">{tagline}</p>
        <h2 className="mt-6 font-display text-[clamp(3.4rem,12vw,11rem)] leading-[0.85] tracking-[-0.03em]">
          <ProximityText text="Open the ledger." />
        </h2>
        <Link href="/login" className="mt-12 inline-flex h-14 items-center gap-2 rounded-full bg-brass px-8 text-lg font-medium text-ink transition-transform hover:scale-[1.04]">
          Sign in <ArrowRight className="size-5" />
        </Link>
      </section>

      <footer className="bg-felt-deep px-5 py-10 text-sm text-paper/60 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5 text-paper/80">
            <ClubMark className="size-6 text-paper" />
            <span className="font-display text-lg">{clubName}</span>
          </span>
          <span>{address}</span>
          <span>© {year} {clubName}</span>
        </div>
      </footer>
    </div>
  );
}
