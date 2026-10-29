import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// esquery can't parse "{n,m}" quantifiers (the comma splits selectors), so
// the 3/6/8-digit forms are spelled out.
const H = "[0-9a-fA-F]";
const HEX = `/#${H}${H}${H}(${H}${H}${H})?(${H}${H})?(?![0-9a-zA-Z_-])/`;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Design rule: components and features only use design tokens.
    files: ["src/components/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${HEX}]`,
          message: "Use a design token (e.g. bg-surface, text-ink-muted) instead of a hex color.",
        },
        {
          selector: `TemplateElement[value.raw=${HEX}]`,
          message: "Use a design token instead of a hex color.",
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
