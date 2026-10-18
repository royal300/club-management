"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatDate } from "@/lib/format";

/** The member's card. On first creation it slides in and gets stamped — a small welcome moment. */
export function MembershipCard({
  clubName,
  name,
  code,
  type,
  joined,
  renewal,
  inactive,
  welcome,
}: {
  clubName: string;
  name: string;
  code: string;
  type: string;
  joined: string;
  renewal: string;
  inactive?: boolean;
  welcome?: boolean;
}) {
  const reduce = useReducedMotion();
  const animate = welcome && !reduce;
  return (
    <motion.div
      initial={animate ? { y: 40, rotate: -8, opacity: 0 } : false}
      animate={{ y: 0, rotate: -1.5, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.1 }}
      className="relative mx-auto w-full max-w-sm"
    >
      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-brass" aria-hidden />
      <div className={`paper-grain relative overflow-hidden rounded-2xl border-2 border-ink bg-paper text-ink ${inactive ? "grayscale" : ""}`}>
        <div className="flex items-center justify-between bg-felt px-4 py-2.5 text-paper">
          <span className="font-display text-lg leading-none">{clubName}</span>
          <span className="font-mono text-[10px] tracking-[0.3em]">MEMBER</span>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="font-display text-2xl leading-tight">{name}</p>
            <p className="font-mono text-sm font-semibold tracking-wide text-felt">{code}</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <dt className="uppercase tracking-wider text-ink/50">Type</dt>
              <dd className="font-medium">{type}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink/50">Since</dt>
              <dd className="font-medium">{formatDate(joined)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink/50">Renews</dt>
              <dd className="font-medium">{formatDate(renewal)}</dd>
            </div>
          </dl>
        </div>
        <div className="h-2 bg-[repeating-linear-gradient(90deg,var(--stamp)_0_12px,var(--brass)_12px_24px,var(--felt)_24px_36px)]" aria-hidden />
        {welcome ? (
          <motion.span
            initial={animate ? { scale: 2.4, opacity: 0, rotate: -30 } : false}
            animate={{ scale: 1, opacity: 0.9, rotate: -14 }}
            transition={{ delay: 0.75, type: "spring", stiffness: 420, damping: 18 }}
            className="absolute right-4 top-14 rounded-md border-[3px] border-stamp px-2 py-0.5 font-mono text-sm font-extrabold tracking-[0.2em] text-stamp"
          >
            WELCOME
          </motion.span>
        ) : null}
        {inactive ? (
          <span className="absolute right-4 top-14 -rotate-12 rounded-md border-[3px] border-ink/60 px-2 py-0.5 font-mono text-sm font-extrabold tracking-[0.2em] text-ink/60">
            INACTIVE
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
