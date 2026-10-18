"use client";

import { useEffect, useRef } from "react";

/** The hero's drifting brass-and-felt fog. Loaded only on capable desktops, after the page is idle. */
export function VantaFog({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    const capable =
      window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches &&
      !nav.connection?.saveData &&
      (nav.deviceMemory ?? 8) >= 4;
    if (!capable) return;

    let effect: { destroy: () => void } | null = null;
    let cancelled = false;
    const start = async () => {
      const [{ default: FOG }, THREE] = await Promise.all([import("vanta/dist/vanta.fog.min"), import("three")]);
      if (cancelled || !ref.current) return;
      effect = FOG({
        el: ref.current,
        THREE,
        mouseControls: true,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        highlightColor: 0xc3912f,
        midtoneColor: 0x135c45,
        lowlightColor: 0x0a2a20,
        baseColor: 0x0a2a20,
        blurFactor: 0.62,
        speed: 0.9,
        zoom: 0.7,
      });
      el.dataset.ready = "true";
    };
    const kick = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => void start(), { timeout: 2500 });
      else setTimeout(() => void start(), 1200);
    };
    if (document.documentElement.dataset.intro === "play") window.addEventListener("intro:done", kick, { once: true });
    else kick();
    return () => {
      cancelled = true;
      window.removeEventListener("intro:done", kick);
      effect?.destroy();
    };
  }, []);
  return <div ref={ref} aria-hidden className={`opacity-0 transition-opacity duration-[1500ms] data-[ready=true]:opacity-100 ${className ?? ""}`} />;
}
