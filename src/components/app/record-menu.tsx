"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RecordMenu({ compact = false }: { compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={compact ? "icon" : "default"} aria-label="Record something new">
          <Plus />
          {compact ? null : "Record"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/transactions/new?kind=INCOME">
            <ArrowDownLeft className="text-income" /> Income received
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/transactions/new?kind=EXPENSE">
            <ArrowUpRight className="text-expense" /> Expense paid
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/members/new">
            <UserPlus /> New member
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/events/new">
            <CalendarDays /> New event
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
