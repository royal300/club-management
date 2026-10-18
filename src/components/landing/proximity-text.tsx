"use client";

import { useEffect, useRef } from "react";

/** Letters swell and turn wonky as the pointer comes near — Fraunces' weight/WONK axes at work. */
export function ProximityText({ text, className, radius = 260 }: { text: string; className?: string; radius?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const chars = Array.from(el.querySelectorAll<HTMLSpanElement>("[data-char]"));
    let frame = 0;
    let px = -9999;
    let py = -9999;
    const render = () => {
      frame = 0;
      for (const c of chars) {
        const r = c.getBoundingClientRect();
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        const t = Math.max(0, 1 - d / radius);
        const e = t * t * (3 - 2 * t);
        c.style.fontVariationSettings = `"wght" ${Math.round(320 + e * 580)}, "WONK" ${e > 0.5 ? 1 : 0}, "opsz" 144`;
        c.style.color = e > 0.55 ? "var(--brass-soft)" : "";
      }
    };
    const onMove = (ev: PointerEvent) => {
      px = ev.clientX;
      py = ev.clientY;
      if (!frame) frame = requestAnimationFrame(render);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [radius]);
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      {text.split("").map((ch, i) => (
        <span key={i} data-char aria-hidden className="inline-block transition-colors duration-200" style={{ fontVariationSettings: '"wght" 320, "WONK" 0, "opsz" 144' }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
