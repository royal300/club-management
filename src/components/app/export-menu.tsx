"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ExportMenu({ entity }: { entity: "members" | "transactions" | "events" | "audit" | "renewals" }) {
  const params = useSearchParams();
  const href = (format: "csv" | "xlsx") => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    next.set("format", format);
    return `/api/export/${entity}?${next}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={href("xlsx")} download>
            <FileSpreadsheet /> Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("csv")} download>
            <FileText /> CSV
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
