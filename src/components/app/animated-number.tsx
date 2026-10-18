"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { formatINR, formatNumber } from "@/lib/format";

/** Counts up from zero the first time it scrolls into view. */
export function AnimatedNumber({
  value,
  format = "inr",
  duration = 1.1,
  className,
  testId,
}: {
  value: number;
  format?: "inr" | "inr-whole" | "number";
  duration?: number;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const fmt = (n: number) =>
    format === "number" ? formatNumber(Math.round(n)) : formatINR(n, { whole: format === "inr-whole" });

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) {
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce]);

  return (
    <span className={className} data-testid={testId} data-value={value} data-final={fmt(value)}>
      <span className="sr-only">{fmt(value)}</span>
      <span ref={ref} aria-hidden>
        {fmt(value)}
      </span>
    </span>
  );
}
