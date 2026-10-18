"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { Role } from "@/db/schema";
import { NAV_ITEMS } from "./nav-items";

export function SidebarLinks({ role, renewalsDue = 0, onNavigate }: { role?: Role; renewalsDue?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_ITEMS.filter((i) => !i.permission || can(role, i.permission)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
              active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-sidebar-primary"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            ) : null}
            <Icon className="relative size-[18px] shrink-0" />
            <span className="relative">{item.label}</span>
            {item.href === "/renewals" && renewalsDue > 0 ? (
              <span
                className={cn(
                  "relative ml-auto rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none tabular",
                  active ? "bg-sidebar-primary-foreground/20" : "bg-stamp text-paper",
                )}
              >
                {renewalsDue}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarLinksFallback() {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      {NAV_ITEMS.slice(0, 6).map((i) => (
        <div key={i.href} className="flex h-10 items-center gap-3 px-3 text-sm text-sidebar-foreground/50">
          <i.icon className="size-[18px]" />
          {i.label}
        </div>
      ))}
    </div>
  );
}
