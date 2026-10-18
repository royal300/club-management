"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "./native-select";

export function FySelect({ years, value, labels }: { years: number[]; value: number; labels: Record<number, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <NativeSelect
      aria-label="Financial year"
      value={String(value)}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("fy", e.target.value);
        router.replace(`${pathname}?${next}`, { scroll: false });
      }}
      className="w-40"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {labels[y]}
        </option>
      ))}
    </NativeSelect>
  );
}
