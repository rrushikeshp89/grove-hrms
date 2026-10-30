"use client";

import { Stat } from "@/components/ui/stat";
import { formatMoney } from "@/lib/format";

/** A count-up amount in rupees. Formatting happens here because functions can't cross from server pages. */
export function MoneyStat({
  label,
  minor,
  compact = true,
}: {
  label: string;
  minor: number;
  compact?: boolean;
}) {
  return (
    <Stat
      label={label}
      value={minor / 100}
      format={(n) => formatMoney(Math.round(n) * 100, "INR", { compact })}
    />
  );
}
