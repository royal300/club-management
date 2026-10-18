"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Clubhouse } from "@/components/illustrations";

export const INTRO_KEY = "club-intro-seen";

/**
 * First-visit intro: the clubhouse lights up, its doors swing open, we push through
 * into the ledger whose pages flip, and the club's name assembles letter by letter.
 * Skippable (button, Esc, Enter, click), shown once per browser, never under reduced motion.
 * The overlay is server-rendered so it covers the very first paint; an inline script
 * hides it before paint for returning visitors, and a CSS failsafe removes it if JS never runs.
 */
export function IntroSequence({ clubName, tagline }: { clubName: string; tagline: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = root.current;
    const html = document.documentElement;
    const finish = () => {
      try {
        localStorage.setItem(INTRO_KEY, "1");
      } catch {}
      html.dataset.intro = "seen";
      window.dispatchEvent(new Event("intro:done"));
      setGone(true);
    };
    if (!el || html.dataset.intro !== "play") {
      window.dispatchEvent(new Event("intro:done"));
      setGone(true);
      return;
    }
    el.style.animation = "none"; // JS is alive — cancel the CSS failsafe
    document.body.style.overflow = "hidden";

    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: finish });

    tl.set(q(".intro-scene"), { autoAlpha: 1 })
      .from(q(".intro-house"), { y: 40, scale: 0.92, autoAlpha: 0, duration: 0.9 })
      .from(q(".intro-house [data-part='window-light'], .intro-house [data-part='lamp']"), { autoAlpha: 0, duration: 0.08, stagger: { each: 0.09, repeat: 1, yoyo: true } }, "-=0.35")
      .to(q(".intro-house [data-part='window-light'], .intro-house [data-part='lamp']"), { autoAlpha: 1, duration: 0.2 })
      .to(q(".intro-door-left"), { rotateY: -112, duration: 1.0, ease: "power2.inOut" }, "+=0.05")
      .to(q(".intro-door-right"), { rotateY: 112, duration: 1.0, ease: "power2.inOut" }, "<")
      .from(q(".intro-glow"), { scale: 0.2, autoAlpha: 0, duration: 0.9, ease: "power2.out" }, "<0.2")
      .to(q(".intro-house-wrap"), { scale: 9, duration: 0.9, ease: "power3.in", transformOrigin: "50% 70%" }, "-=0.25")
      .to(q(".intro-flood"), { autoAlpha: 1, duration: 0.35 }, "-=0.4")
      .set(q(".intro-scene"), { autoAlpha: 0 })
      .from(q(".intro-ledger"), { y: 60, rotateX: 25, autoAlpha: 0, duration: 0.6 }, "-=0.05")
      .to(q(".intro-page"), { rotateY: -178, duration: 0.42, ease: "power2.inOut", stagger: 0.16 }, "+=0.05")
      .to(q(".intro-ledger"), { y: -40, autoAlpha: 0, scale: 0.94, duration: 0.45, ease: "power2.in" }, "-=0.05")
      .set(q(".intro-name"), { autoAlpha: 1 })
      .from(
        q(".intro-char"),
        {
          x: () => gsap.utils.random(-260, 260),
          y: () => gsap.utils.random(-220, 220),
          rotate: () => gsap.utils.random(-90, 90),
          scale: () => gsap.utils.random(0.4, 1.8),
          autoAlpha: 0,
          duration: 0.9,
          ease: "expo.out",
          stagger: { each: 0.035, from: "random" },
        },
        "-=0.15",
      )
      .from(q(".intro-word"), { yPercent: 110, duration: 0.5, stagger: 0.12 }, "-=0.35")
      .to(q(".intro-rule"), { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, "<")
      .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.85, ease: "expo.inOut" }, "+=0.55");

    tl.eventCallback("onUpdate", () => {
      const bar = el.querySelector<HTMLElement>(".intro-progress");
      if (bar) bar.style.transform = `scaleX(${tl.progress()})`;
    });

    const skip = () => {
      if (tl.progress() > 0.92) return;
      tl.tweenTo(tl.duration(), { duration: 0.01 });
      gsap.to(el, { autoAlpha: 0, duration: 0.35, onComplete: () => tl.progress(1) });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);
    el.querySelector(".intro-skip")?.addEventListener("click", skip);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (gone) document.body.style.overflow = "";
  }, [gone]);

  if (gone) return null;

  const words = tagline.split(" ");
  return (
    <div
      id="club-intro"
      ref={root}
      role="dialog"
      aria-label={`${clubName} — introduction`}
      className="fixed inset-0 z-[100] overflow-hidden bg-felt-deep text-paper"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
    >
      {/* Scene 1: the clubhouse */}
      <div className="intro-scene invisible absolute inset-0 grid place-items-center">
        <div className="intro-house-wrap relative w-[min(78vw,560px)]">
          <div className="intro-house relative">
            <Clubhouse withDoors={false} className="w-full" />
            {/* Doors are HTML so they can swing in real 3D; positions mirror the SVG doorway. */}
            <div className="absolute" style={{ left: "41.905%", top: "52.35%", width: "16.19%", height: "36.47%", perspective: "600px" }}>
              <div className="intro-glow absolute inset-0 rounded-t-full bg-[radial-gradient(circle_at_50%_60%,#fff6dc,var(--brass-soft)_45%,transparent_75%)]" />
              <div
                className="intro-door-left absolute left-0 top-0 h-full w-1/2 border-[2px] border-ink bg-felt"
                style={{ transformOrigin: "0% 50%", borderTopLeftRadius: "100% 27.4%", backfaceVisibility: "hidden" }}
              >
                <span className="absolute right-1 top-[70%] size-1.5 rounded-full bg-brass" />
              </div>
              <div
                className="intro-door-right absolute right-0 top-0 h-full w-1/2 border-[2px] border-ink bg-felt"
                style={{ transformOrigin: "100% 50%", borderTopRightRadius: "100% 27.4%", backfaceVisibility: "hidden" }}
              >
                <span className="absolute left-1 top-[70%] size-1.5 rounded-full bg-brass" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="intro-flood invisible absolute inset-0 bg-paper" />

      {/* Scene 2: the ledger */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center" style={{ perspective: "1400px" }}>
        <div className="intro-ledger invisible relative h-[min(46vw,300px)] w-[min(84vw,520px)]" style={{ transformStyle: "preserve-3d" }}>
          <div className="absolute inset-0 rounded-md bg-felt shadow-2xl" />
          <div className="ledger-lines absolute inset-y-3 left-3 right-1/2 rounded-l-sm bg-paper" />
          <div className="ledger-lines absolute inset-y-3 left-1/2 right-3 rounded-r-sm bg-paper">
            <p className="p-5 font-mono text-[11px] leading-[28px] text-ink/70">
              Subscription ……… ₹1,200
              <br />
              Donation ………… ₹5,001
              <br />
              Sponsorship …… ₹50,000
            </p>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="intro-page ledger-lines absolute inset-y-3 left-1/2 right-3 rounded-r-sm border-l border-ink/10 bg-paper shadow-md"
              style={{ transformOrigin: "0% 50%", zIndex: 3 - i, backfaceVisibility: "hidden" }}
            >
              <span className="absolute bottom-3 right-4 font-mono text-[10px] text-ink/40">{String(42 + i * 2).padStart(3, "0")}</span>
            </div>
          ))}
          <div className="absolute inset-y-0 left-1/2 w-px bg-ink/30" />
        </div>
      </div>

      {/* Scene 3: the name */}
      <div className="intro-name invisible pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-ink">
        <div>
          <h2 className="font-display text-[clamp(3.4rem,13vw,10rem)] leading-[0.9] tracking-tight" aria-label={clubName}>
            {clubName.split("").map((ch, i) => (
              <span key={i} className="intro-char inline-block will-change-transform" aria-hidden>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h2>
          <div className="intro-rule mx-auto my-5 h-[3px] w-40 origin-left scale-x-0 bg-stamp" />
          <p className="font-display text-[clamp(1.1rem,2.6vw,1.8rem)] italic">
            {words.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden align-bottom">
                <span className="intro-word inline-block">{w}&nbsp;</span>
              </span>
            ))}
          </p>
        </div>
      </div>

      <button type="button" className="intro-skip absolute bottom-6 right-6 z-10 rounded-full border border-current/30 bg-black/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-current mix-blend-difference backdrop-blur hover:bg-black/20">
        Skip intro ↵
      </button>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
        <div className="intro-progress h-full origin-left scale-x-0 bg-brass" />
      </div>
    </div>
  );
}

/** Runs before first paint: decides whether the intro plays, so returning visitors never see a flash. */
export const INTRO_GATE_SCRIPT = `(function(){var d=document.documentElement;d.classList.add('js');try{var seen=localStorage.getItem('${INTRO_KEY}')==='1';var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;d.dataset.intro=(seen||rm)?'seen':'play';}catch(e){d.dataset.intro='seen';}})();`;
