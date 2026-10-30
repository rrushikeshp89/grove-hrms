import { describe, expect, it } from "vitest";

import { csvCell, missingColumns, normalizeHeader, parseCsv, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain values alone and quotes what needs it", () => {
    expect(csvCell("Priya Raman")).toBe("Priya Raman");
    expect(csvCell("Raman, Priya")).toBe('"Raman, Priya"');
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("handles blanks, numbers, booleans and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(42.5)).toBe("42.5");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(true)).toBe("Yes");
    expect(csvCell(new Date("2026-10-30T10:00:00Z"))).toBe("2026-10-30T10:00:00.000Z");
  });

  it("defuses text a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    // Equals inside the text is fine.
    expect(csvCell("a=b")).toBe("a=b");
  });
});

describe("toCsv", () => {
  it("writes a header row and one line per record, CRLF separated", () => {
    const csv = toCsv(
      [
        { key: "name", label: "Name" },
        { key: "days", label: "Days" },
      ],
      [
        { name: "Arjun", days: 2 },
        { name: "=bad", days: 0.5 },
      ],
    );
    expect(csv).toBe("Name,Days\r\nArjun,2\r\n'=bad,0.5\r\n");
  });
});

describe("parseCsv", () => {
  it("reads headers loosely and trims cells", () => {
    const r = parseCsv(
      "First Name, Work-Email\r\n Ana , ana@northwindgrove.in \r\n\r\nRaj,raj@northwindgrove.in\r\n",
    );
    expect(r.headers).toEqual(["first_name", "work_email"]);
    expect(r.rows).toEqual([
      { first_name: "Ana", work_email: "ana@northwindgrove.in" },
      { first_name: "Raj", work_email: "raj@northwindgrove.in" },
    ]);
    expect(r.problems).toEqual([]);
  });

  it("copes with a byte order mark, quoted commas and blank lines", () => {
    const r = parseCsv('﻿name,note\n"Iyer, Ananya","said ""yes"""\n\n');
    expect(r.headers).toEqual(["name", "note"]);
    expect(r.rows).toEqual([{ name: "Iyer, Ananya", note: 'said "yes"' }]);
  });

  it("refuses very large files", () => {
    const r = parseCsv("a\n" + "x".repeat(1_100_000));
    expect(r.rows).toEqual([]);
    expect(r.problems[0]).toMatch(/too large/);
  });

  it("reports which required columns are missing", () => {
    expect(missingColumns(["first_name", "email"], ["first_name", "last_name", "email"])).toEqual([
      "last_name",
    ]);
    expect(normalizeHeader("  Join Date ")).toBe("join_date");
  });
});
