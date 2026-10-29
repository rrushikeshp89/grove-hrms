/**
 * Per-user display preferences that must apply before first paint. They're
 * mirrored to localStorage now; Phase 2 also persists them on the user row.
 */
export type Density = "comfortable" | "compact";
export type ThemePref = "light" | "dark" | "system";

export const PREF_KEYS = {
  theme: "grove.theme",
  density: "grove.density",
  sidebar: "grove.sidebar",
} as const;

/**
 * Runs inline in <head> before React hydrates, so theme, density and the
 * sidebar width never flash. Kept tiny and dependency-free on purpose.
 */
export const preferencesScript = `(() => {
  try {
    const root = document.documentElement;
    const t = localStorage.getItem("${PREF_KEYS.theme}");
    const dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    if (localStorage.getItem("${PREF_KEYS.density}") === "compact") root.dataset.density = "compact";
    if (localStorage.getItem("${PREF_KEYS.sidebar}") === "collapsed") root.dataset.sidebar = "collapsed";
  } catch (_) {}
})();`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode or blocked storage: the preference just won't persist
  }
}

/* ─── Theme ────────────────────────────────────────────────────────────── */

export const THEME_EVENT = "grove:theme";

export function getThemePref(): ThemePref {
  const t = read(PREF_KEYS.theme);
  return t === "light" || t === "dark" ? t : "system";
}

export function systemPrefersDark() {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies the theme without animating every color on the page. */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(freeze);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  // Force a style flush before re-enabling transitions.
  void getComputedStyle(root).color;
  requestAnimationFrame(() => freeze.remove());
}

export function setThemePref(pref: ThemePref) {
  store(PREF_KEYS.theme, pref === "system" ? null : pref);
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/* ─── Density and sidebar ──────────────────────────────────────────────── */

export function setDensity(d: Density) {
  if (d === "compact") document.documentElement.dataset.density = "compact";
  else delete document.documentElement.dataset.density;
  store(PREF_KEYS.density, d === "compact" ? "compact" : null);
}

export function getDensity(): Density {
  return document.documentElement.dataset.density === "compact" ? "compact" : "comfortable";
}

export function setSidebarCollapsed(collapsed: boolean) {
  if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
  store(PREF_KEYS.sidebar, collapsed ? "collapsed" : null);
}

export function isSidebarCollapsed() {
  return document.documentElement.dataset.sidebar === "collapsed";
}
