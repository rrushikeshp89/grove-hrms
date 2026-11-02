"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import * as React from "react";

import { ActionsProvider } from "@/components/shell/actions-provider";
import { Celebration } from "@/components/ui/celebrate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const motionEngine = () => import("@/lib/motion-features").then((mod) => mod.default);

/**
 * For the signed-in app and the design showcase. Sign-in pages stay out of this
 * on purpose: they are the first thing anyone loads. Components import `m as motion`
 * and the engine arrives after paint, so a phone never waits on it to see the page.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // "user" = honor prefers-reduced-motion for every Motion animation
    <LazyMotion features={motionEngine}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300} skipDelayDuration={150}>
          <ActionsProvider>
            {children}
            <Toaster />
            <Celebration />
          </ActionsProvider>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
