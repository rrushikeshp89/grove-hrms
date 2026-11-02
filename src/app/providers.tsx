"use client";

import { domAnimation, LazyMotion, MotionConfig, type FeatureBundle } from "motion/react";
import * as React from "react";

import { ActionsProvider } from "@/components/shell/actions-provider";
import { Celebration } from "@/components/ui/celebrate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Adds layout animations once the page has settled. Motion registers features
 * globally, so this sits beside the app rather than around it: LazyMotion's own
 * async mode updates state above every Suspense boundary, and if that lands while
 * one is still streaming, React re-renders it on the client and doubles the work.
 */
function LayoutAnimations() {
  const [features, setFeatures] = React.useState<FeatureBundle | null>(null);
  React.useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      const engine = (await import("@/lib/motion-features")).default;
      if (live) setFeatures(engine);
    }, 2000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);
  return features ? <LazyMotion features={features}>{null}</LazyMotion> : null;
}

/**
 * For the signed-in app and the design showcase. Sign-in pages stay out of this
 * on purpose: they are the first thing anyone loads. Components import from `motion/react-m`
 * and only the small animation bundle loads up front.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // "user" = honor prefers-reduced-motion for every Motion animation
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300} skipDelayDuration={150}>
          <ActionsProvider>
            {children}
            <Toaster />
            <Celebration />
          </ActionsProvider>
        </TooltipProvider>
      </MotionConfig>
      <LayoutAnimations />
    </LazyMotion>
  );
}
