import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  canDeleteDocument,
  canSeeDocument,
  formatBytes,
  isInline,
  safeFileName,
  uploadProblem,
} from "./rules";

describe("uploadProblem", () => {
  const ok = { name: "Offer letter.pdf", size: 120_000, type: "application/pdf" };
  it("accepts ordinary documents", () => {
    expect(uploadProblem(ok)).toBeNull();
    expect(uploadProblem({ name: "scan.JPG", size: 10, type: "image/jpeg" })).toBeNull();
    expect(uploadProblem({ name: "notes.txt", size: 10, type: "" })).toBeNull();
  });
  it("rejects empty, huge and unknown files", () => {
    expect(uploadProblem({ ...ok, size: 0 })).toMatch(/empty/);
    expect(uploadProblem({ ...ok, size: MAX_UPLOAD_BYTES + 1 })).toMatch(/5 MB/);
    expect(uploadProblem({ name: "run.exe", size: 10, type: "application/x-msdownload" })).toMatch(
      /Upload a PDF/,
    );
    expect(uploadProblem({ name: "noextension", size: 10, type: "" })).toMatch(/Upload a PDF/);
  });
  it("rejects a file whose type contradicts its name", () => {
    expect(uploadProblem({ name: "photo.png", size: 10, type: "application/pdf" })).toMatch(
      /doesn't look like/,
    );
  });
});

describe("file names and sizes", () => {
  it("makes names safe for keys and headers", () => {
    expect(safeFileName("../../etc/Résumé final (v2).pdf")).toBe("Resume-final-v2.pdf");
    expect(safeFileName("C:\\Users\\me\\payslip.pdf")).toBe("payslip.pdf");
    expect(safeFileName("....pdf")).toBe("file.pdf");
    expect(safeFileName("a".repeat(200) + ".png").length).toBeLessThanOrEqual(64);
  });
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(20_480)).toBe("20 KB");
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
  });
  it("opens PDFs and images in the browser", () => {
    expect(isInline("application/pdf")).toBe(true);
    expect(isInline("image/png")).toBe(true);
    expect(
      isInline("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(false);
  });
});

describe("who can see and delete", () => {
  const me = { employeeId: "me", manage: false };
  const other = { employeeId: "other", manage: false };
  const hr = { employeeId: "hr", manage: true };
  const mine = { ownerEmployeeId: "me", visibility: "PRIVATE" as const, uploadedById: "me" };
  const policy = { ownerEmployeeId: null, visibility: "COMPANY" as const, uploadedById: "hr" };
  const hrOnly = { ownerEmployeeId: "me", visibility: "HR_ONLY" as const, uploadedById: "hr" };

  it("shows company documents to everyone", () => {
    expect(canSeeDocument(other, policy)).toBe(true);
  });
  it("keeps private documents to their owner and the people team", () => {
    expect(canSeeDocument(me, mine)).toBe(true);
    expect(canSeeDocument(other, mine)).toBe(false);
    expect(canSeeDocument(hr, mine)).toBe(true);
    expect(canSeeDocument({ employeeId: null, manage: false }, mine)).toBe(false);
  });
  it("keeps people-team-only documents from their owner too", () => {
    expect(canSeeDocument(me, hrOnly)).toBe(false);
    expect(canSeeDocument(hr, hrOnly)).toBe(true);
  });
  it("lets people delete only their own uploads", () => {
    expect(canDeleteDocument(me, mine)).toBe(true);
    expect(canDeleteDocument(me, { ...mine, uploadedById: "hr" })).toBe(false);
    expect(canDeleteDocument(me, policy)).toBe(false);
    expect(canDeleteDocument(other, mine)).toBe(false);
    expect(canDeleteDocument(hr, policy)).toBe(true);
  });
});
