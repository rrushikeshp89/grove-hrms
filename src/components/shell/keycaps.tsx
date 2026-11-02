"use client";

import * as React from "react";

import { Kbd } from "@/components/ui/primitives";
import { formatShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

import { useIsMac } from "./actions-provider";

export function Keycaps({ spec, className }: { spec: string; className?: string }) {
  const isMac = useIsMac();
  const steps = formatShortcut(spec, isMac);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {steps.map((caps, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-caption text-ink-subtle">then</span>}
          <span className="inline-flex gap-0.5">
            {caps.map((c) => (
              <Kbd key={c}>{c}</Kbd>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}
