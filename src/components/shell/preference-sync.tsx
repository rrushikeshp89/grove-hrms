"use client";

import * as React from "react";

import { updatePreferences } from "@/features/account/actions";
import {
  THEME_EVENT,
  getDensity,
  getThemePref,
  setDensity,
  setThemePref,
  type ThemePref,
} from "@/lib/preferences";

import type { ShellUser } from "./user-menu";

const toDb = { light: "LIGHT", dark: "DARK", system: "SYSTEM" } as const;
const fromDb = { LIGHT: "light", DARK: "dark", SYSTEM: "system" } as const;

/**
 * Signed-in preferences live on the user row so they follow you between
 * devices. On load the saved values win; after that, any change made
 * anywhere in the app (menu, palette, shortcut) is saved back.
 */
export function PreferenceSync({ user }: { user: Pick<ShellUser, "themePref" | "densityPref"> }) {
  const saved = React.useRef({ theme: user.themePref, density: user.densityPref });

  React.useEffect(() => {
    const theme = fromDb[user.themePref];
    if (getThemePref() !== theme) setThemePref(theme);
    const density = user.densityPref === "COMPACT" ? "compact" : "comfortable";
    if (getDensity() !== density) setDensity(density);
    // Only on first mount: later prop changes come from our own saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    function save(patch: { theme?: ThemePref; density?: "comfortable" | "compact" }) {
      const next = {
        theme: patch.theme ? toDb[patch.theme] : saved.current.theme,
        density: patch.density
          ? patch.density === "compact"
            ? "COMPACT"
            : "COMFORTABLE"
          : saved.current.density,
      } as const;
      if (next.theme === saved.current.theme && next.density === saved.current.density) return;
      saved.current = next;
      void updatePreferences({ theme: next.theme, density: next.density });
    }
    const onTheme = () => save({ theme: getThemePref() });
    const obs = new MutationObserver(() => save({ density: getDensity() }));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-density"] });
    window.addEventListener(THEME_EVENT, onTheme);
    return () => {
      obs.disconnect();
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);

  return null;
}
