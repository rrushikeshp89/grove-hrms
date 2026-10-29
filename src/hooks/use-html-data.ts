"use client";

import * as React from "react";

/**
 * Reads a data-* attribute on <html>. Preferences live there (set before
 * paint by lib/preferences.ts), so the DOM is the single source of truth and
 * React just subscribes to it.
 */
export function useHtmlData(name: "density" | "sidebar"): string | undefined {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const obs = new MutationObserver(onChange);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [`data-${name}`],
      });
      return () => obs.disconnect();
    },
    [name],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset[name],
    () => undefined,
  );
}
