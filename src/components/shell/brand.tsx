import { Sprout } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[9px] bg-accent text-accent-fg shadow-press",
        className,
      )}
    >
      <Sprout className="size-[18px]" strokeWidth={2} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display-soft text-[1.375rem] leading-none font-medium tracking-[-0.02em] text-ink",
        className,
      )}
    >
      Grove
    </span>
  );
}
