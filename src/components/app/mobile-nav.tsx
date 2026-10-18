"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ClubMark } from "@/components/illustrations";
import type { Role } from "@/db/schema";
import { SidebarLinks } from "./sidebar-links";

export function MobileNav({ role, clubName, renewalsDue }: { role: Role; clubName: string; renewalsDue: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle asChild>
            <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
              <ClubMark className="size-7 text-sidebar-foreground" />
              <span className="font-display text-lg">{clubName}</span>
            </Link>
          </SheetTitle>
        </SheetHeader>
        <SidebarLinks role={role} renewalsDue={renewalsDue} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
