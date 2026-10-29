"use client";

import * as React from "react";

import {
  THEME_EVENT,
  applyTheme,
  getThemePref,
  setThemePref,
  type ThemePref,
} from "@/lib/preferences";

function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getThemePref() === "system") applyTheme("system");
    onChange();
  };
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  media.addEventListener("change", onSystem);
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    obs.disconnect();
    media.removeEventListener("change", onSystem);
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * `theme` is the saved preference; `resolvedTheme` is what's on screen.
 * Both are undefined during server render and hydration.
 */
export function useTheme() {
  const theme = React.useSyncExternalStore<ThemePref | undefined>(
    subscribe,
    getThemePref,
    () => undefined,
  );
  const resolvedTheme = React.useSyncExternalStore<"light" | "dark" | undefined>(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => undefined,
  );
  return { theme, resolvedTheme, setTheme: setThemePref };
}
