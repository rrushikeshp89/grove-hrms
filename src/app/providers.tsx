"use client";

import { MotionConfig } from "motion/react";
import * as React from "react";

import { ActionsProvider } from "@/components/shell/actions-provider";
import { Celebration } from "@/components/ui/celebrate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * For the signed-in app and the design showcase. Sign-in pages stay out of this
 * on purpose: it brings in all of Motion, and they are the first thing anyone loads.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // "user" = honor prefers-reduced-motion for every Motion animation
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300} skipDelayDuration={150}>
        <ActionsProvider>
          {children}
          <Toaster />
          <Celebration />
        </ActionsProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
