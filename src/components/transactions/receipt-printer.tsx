"use client";

import { motion, useReducedMotion } from "motion/react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR } from "@/lib/format";

/** The small celebration after recording money: a receipt feeds out of the printer and gets stamped. */
export function ReceiptPrinter({
  id,
  clubName,
  documentNo,
  kind,
  amount,
  party,
  label,
  date,
  mode,
  play = true,
}: {
  play?: boolean;
  id: number;
  clubName: string;
  documentNo: string | null;
  kind: "INCOME" | "EXPENSE";
  amount: string;
  party: string;
  label: string;
  date: string;
  mode: string;
}) {
  const reduce = useReducedMotion() || !play;
  const pending = !documentNo;
  const lines = [
    [kind === "INCOME" ? "Received from" : "Paid to", party],
    ["For", label],
    ["Date", formatDate(date)],
    ["Mode", mode],
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-live="polite">
      {/* printer */}
      <div className="relative z-10 rounded-2xl bg-felt px-5 pb-3 pt-4 text-paper shadow-lg dark:bg-felt-deep dark:ring-1 dark:ring-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.2em] text-paper/70">
            <Printer className="size-3.5" /> {pending ? "Recorded" : "Printing"}
          </span>
          <motion.span
            className="size-2 rounded-full bg-brass"
            animate={reduce ? undefined : { opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.8, repeat: 2 }}
          />
        </div>
        <div className="mt-3 h-2 rounded-full bg-black/40" />
      </div>
      {/* paper */}
      <div className="relative -mt-2 overflow-hidden px-4">
        <motion.div
          initial={reduce ? false : { y: "-100%" }}
          animate={{ y: 0 }}
          transition={{ duration: 1.1, ease: [0.45, 0, 0.2, 1], delay: 0.15 }}
          className="zigzag-bottom ledger-lines bg-paper px-5 pb-8 pt-5 text-ink shadow-md"
        >
          <p className="text-center font-display text-lg">{clubName}</p>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">
            {kind === "INCOME" ? "Money receipt" : "Payment voucher"}
          </p>
          <p className="mt-1 text-center font-mono text-xs font-semibold">{documentNo ?? "Pending — no receipt yet"}</p>
          <dl className="mt-4 space-y-1.5 text-xs">
            {lines.map(([k, val], i) => (
              <motion.div
                key={k}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="flex justify-between gap-4 border-b border-dashed border-ink/20 pb-1"
              >
                <dt className="text-ink/60">{k}</dt>
                <dd className="truncate text-right font-medium">{val}</dd>
              </motion.div>
            ))}
          </dl>
          <p className="mt-4 text-right font-mono text-2xl font-semibold tabular">{formatINR(amount)}</p>
          {!pending ? (
            <motion.span
              initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -35 }}
              animate={{ scale: 1, opacity: 0.85, rotate: -12 }}
              transition={{ delay: 1.35, type: "spring", stiffness: 420, damping: 16 }}
              className="absolute bottom-12 left-8 rounded-md border-[3px] border-stamp px-2.5 py-0.5 font-mono text-lg font-extrabold tracking-[0.25em] text-stamp"
            >
              {kind === "INCOME" ? "RECEIVED" : "PAID"}
            </motion.span>
          ) : null}
        </motion.div>
      </div>
      {!pending ? (
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="mt-4 flex justify-center">
          <Button asChild>
            <a href={`/api/receipts/${id}`} target="_blank" rel="noopener">
              <Download /> Download {kind === "INCOME" ? "receipt" : "voucher"} (PDF)
            </a>
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
}
