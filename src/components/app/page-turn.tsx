"use client";

import { motion, useReducedMotion } from "motion/react";

/** A quick, subtle page-turn as you move between sections of the ledger (<250ms). */
export function PageTurn({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -5, x: -10 }}
      animate={{ opacity: 1, rotateY: 0, x: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformPerspective: 1400, transformOrigin: "0% 50%" }}
    >
      {children}
    </motion.div>
  );
}
