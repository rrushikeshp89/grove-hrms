import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the design system: every text/background pair we rely on meets
 * WCAG 2.1 AA in both themes, and components never hardcode colors.
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in globals.css`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) vars[m[1]!] = m[2]!;
  return vars;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const themes = { light: block(":root"), dark: block(".dark") };

// [foreground, background, minimum ratio]
const TEXT = 4.5;
const UI = 3; // non-text: field borders, focus ring
const pairs: [string, string, number][] = [
  ["ink", "bg", TEXT],
  ["ink", "surface", TEXT],
  ["ink-muted", "bg", TEXT],
  ["ink-muted", "surface", TEXT],
  ["ink-muted", "surface-sunken", TEXT],
  ["ink-subtle", "bg", TEXT],
  ["ink-subtle", "surface", TEXT],
  ["ink-subtle", "surface-sunken", TEXT],
  ["accent-fg", "accent", TEXT],
  ["accent", "bg", TEXT],
  ["accent", "surface", TEXT],
  ["accent", "accent-subtle", TEXT],
  ["danger-fg", "danger", TEXT],
  ["highlight-fg", "highlight", TEXT],
  ["highlight-ink", "highlight-subtle", TEXT],
  ["success", "success-subtle", TEXT],
  ["success", "surface", TEXT],
  ["warning", "warning-subtle", TEXT],
  ["warning", "surface", TEXT],
  ["danger", "danger-subtle", TEXT],
  ["danger", "surface", TEXT],
  ["info", "info-subtle", TEXT],
  ["info", "surface", TEXT],
  ["border-input", "surface", UI],
  ["accent", "surface", UI],
];

describe.each(Object.entries(themes))("%s theme contrast", (_name, t) => {
  it.each(pairs)("%s on %s", (fg, bg, min) => {
    expect(t[fg], `--${fg} missing`).toBeDefined();
    expect(t[bg], `--${bg} missing`).toBeDefined();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

describe("token discipline", () => {
  it("defines the same tokens in light and dark", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
    });
  }

  it("never uses arbitrary color values in class names", () => {
    const offenders = ["src/components", "src/app", "src/features"]
      .flatMap((d) => {
        try {
          return files(join(process.cwd(), d));
        } catch {
          return [];
        }
      })
      .filter((f) =>
        /(bg|text|border|ring|fill|stroke|from|to|via)-\[(#|rgb|hsl|oklch)/.test(
          readFileSync(f, "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
