/**
 * The "Warm Calm" light palette as literal colors. PDFs can't read CSS
 * variables, so documents rendered server-side take these values instead.
 * Keep them in step with the light tokens in globals.css.
 */
export const PDF = {
  white: "#ffffff",
  ink: "#1c1917",
  inkMuted: "#57534e",
  inkSubtle: "#736b64",
  hairline: "#e8e3db",
  surfaceSunken: "#f3f0ea",
  accent: "#1f5c4a",
  accentSubtle: "#e5eeea",
  highlightSubtle: "#fbf0dc",
  highlightInk: "#7a4e0e",
} as const;
