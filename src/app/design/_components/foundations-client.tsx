"use client";

import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { gentle, snappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Shows the token's resolved value in the current theme. */
export function TokenValue({ token }: { token: string }) {
  const { resolvedTheme } = useTheme();
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    // Read after the theme class has been applied.
    const id = requestAnimationFrame(() =>
      setValue(getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim()),
    );
    return () => cancelAnimationFrame(id);
  }, [token, resolvedTheme]);
  return (
    <span className="font-mono num text-caption text-ink-subtle uppercase">{value || " "}</span>
  );
}

export function Swatch({
  token,
  className,
  usage,
  fg,
}: {
  token: string;
  /** Static Tailwind class for the fill, so the class is generated. */
  className: string;
  usage: string;
  /** Optional text class to show legibility on the fill. */
  fg?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "grid h-16 place-items-center rounded-control border border-hairline",
          className,
        )}
      >
        {fg && <span className={cn("text-small font-medium", fg)}>Aa</span>}
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-caption text-ink">--{token}</span>
        <TokenValue token={token} />
        <span className="mt-0.5 text-caption text-ink-muted">{usage}</span>
      </div>
    </div>
  );
}

export function SpringDemo() {
  const [on, setOn] = React.useState(false);
  const reduce = useReducedMotion();
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-3">
        {(
          [
            ["snappy", snappy, "Toggles, menus, press states"],
            ["gentle", gentle, "Panels, sheets, layout shifts"],
          ] as const
        ).map(([name, t, use]) => (
          <div key={name} className="flex items-center gap-4">
            <div className="w-28 shrink-0">
              <p className="font-mono text-small text-ink">{name}</p>
              <p className="text-caption text-ink-subtle">{use}</p>
            </div>
            <div className="relative h-9 flex-1 rounded-full bg-surface-sunken">
              <motion.span
                className="absolute top-1 left-1 size-7 rounded-full bg-accent shadow-sm"
                animate={{ left: on ? "calc(100% - 2rem)" : "0.25rem" }}
                transition={reduce ? { duration: 0 } : t}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setOn((v) => !v)}>
          Play both springs
        </Button>
        {reduce && (
          <span className="text-small text-ink-muted">
            Reduced motion is on, so these move instantly.
          </span>
        )}
      </div>
    </div>
  );
}
