/**
 * A tiny PDF writer for seeded documents: a title and paragraphs, wrapped
 * and paginated in Helvetica. No dependencies, valid PDF 1.4 any viewer opens.
 */

const PAGE = { w: 595, h: 842, margin: 62 };

/** The built-in fonts only cover Latin-1, so swap the few characters outside it. */
function latin1(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/₹/g, "Rs. ")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "");
}

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function wrap(text: string, size: number, width: number): string[] {
  const perLine = Math.floor(width / (size * 0.5));
  const lines: string[] = [];
  let line = "";
  for (const word of latin1(text).split(/\s+/)) {
    if (!word) continue;
    if ((line + " " + word).trim().length > perLine) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

type Item = { text: string; size: number; bold: boolean; gap: number };

export function simplePdf(
  title: string,
  paragraphs: string[],
  footer = "Northwind Grove Technologies Pvt. Ltd.",
): Uint8Array {
  const width = PAGE.w - PAGE.margin * 2;
  const items: Item[] = [];
  for (const line of wrap(title, 22, width))
    items.push({ text: line, size: 22, bold: true, gap: 28 });
  items.push({ text: "", size: 11, bold: false, gap: 8 });
  for (const p of paragraphs) {
    const heading = p.startsWith("# ");
    const body = heading ? p.slice(2) : p;
    for (const line of wrap(body, heading ? 13 : 11, width)) {
      items.push({ text: line, size: heading ? 13 : 11, bold: heading, gap: heading ? 20 : 16 });
    }
    items.push({ text: "", size: 11, bold: false, gap: heading ? 2 : 6 });
  }

  const pages: string[] = [];
  let y = PAGE.h - PAGE.margin;
  let ops: string[] = [];
  const flush = () => {
    ops.push(`BT /F1 8 Tf ${PAGE.margin} 34 Td (${escape(latin1(footer))}) Tj ET`);
    pages.push(ops.join("\n"));
    ops = [];
    y = PAGE.h - PAGE.margin;
  };
  for (const it of items) {
    if (y - it.gap < PAGE.margin) flush();
    y -= it.gap;
    if (it.text)
      ops.push(
        `BT /${it.bold ? "F2" : "F1"} ${it.size} Tf ${PAGE.margin} ${y} Td (${escape(it.text)}) Tj ET`,
      );
  }
  flush();

  // Object numbers: 1 catalog, 2 pages, 3 and 4 fonts, then (content, page) pairs.
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 6 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, i) => {
    const contentId = 5 + i * 2;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[contentId + 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++)
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
