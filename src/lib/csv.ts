import Papa from "papaparse";

/**
 * CSV in and out. Exports are opened in spreadsheets, where a cell that
 * starts with = + - @ (or a tab or carriage return) can run as a formula, so
 * text like that is prefixed with an apostrophe. Numbers are never touched.
 */

export type Column<T> = { key: keyof T & string; label: string };

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(columns: Column<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.label)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c.key])).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** A download response. The BOM makes Excel read UTF-8 names correctly. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const MAX_CSV_BYTES = 1_000_000;

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  /** Problems with the file as a whole (not row by row). */
  problems: string[];
};

/** Column names are matched loosely: "Work email", "work_email" and "WORK-EMAIL" are the same. */
export const normalizeHeader = (h: string) =>
  h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

export function parseCsv(text: string): ParsedCsv {
  if (text.length > MAX_CSV_BYTES) {
    return { headers: [], rows: [], problems: ["That file is too large. Keep it under 1 MB."] };
  }
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  const problems = result.errors
    .filter((e) => e.type !== "FieldMismatch")
    .map((e) => `Line ${e.row !== undefined ? e.row + 2 : "?"}: ${e.message}`);
  return { headers: result.meta.fields ?? [], rows: result.data, problems };
}

/** Which of the required columns a file is missing. */
export function missingColumns(headers: readonly string[], required: readonly string[]): string[] {
  const have = new Set(headers);
  return required.filter((c) => !have.has(c));
}
