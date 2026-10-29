"use client";

import { format } from "date-fns";
import { Coffee, Sparkles, Sprout } from "lucide-react";

import { useMounted } from "@/hooks/use-mounted";
import { dayPart, greeting } from "@/lib/format";

/** Uses the viewer's clock, so it renders after hydration. */
export function Greeting({ firstName, summary }: { firstName: string; summary: React.ReactNode }) {
  const mounted = useMounted();
  const now = mounted ? new Date() : null;
  const part = now ? dayPart(now.getHours()) : null;
  const Icon = part === "morning" ? Coffee : part === "afternoon" ? Sprout : Sparkles;
  return (
    <div>
      <p className="mb-3 inline-flex min-h-4 items-center gap-1.5 eyebrow">
        {now && (
          <>
            <Icon className="size-3.5" aria-hidden />
            {format(now, "EEEE, d MMMM")}
          </>
        )}
      </p>
      <h1 className="font-display-soft text-display font-medium text-ink sm:text-display-xl">
        {now ? greeting(firstName, now.getHours()) : `Welcome back, ${firstName}`}
      </h1>
      <p className="mt-2 max-w-2xl text-body text-ink-muted">{summary}</p>
    </div>
  );
}
