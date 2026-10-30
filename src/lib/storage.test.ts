import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalStorage, createSupabaseStorage, storageFromEnv } from "./storage";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("local storage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "grove-storage-"));
    process.env.UPLOAD_DIR = dir;
  });
  afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("writes, reads and deletes, and a missing file reads as null", async () => {
    const s = createLocalStorage();
    await s.put("a/b.txt", bytes("hello"));
    expect((await s.get("a/b.txt"))?.toString()).toBe("hello");
    await s.delete("a/b.txt");
    expect(await s.get("a/b.txt")).toBeNull();
  });

  it("refuses keys that climb out of the folder", async () => {
    const s = createLocalStorage();
    await expect(s.put("../escape.txt", bytes("x"))).rejects.toThrow("Invalid storage key");
  });
});

describe("Supabase storage", () => {
  const opts = { url: "https://abc.supabase.co/", serviceKey: "service-key" };

  it("uploads to the bucket with the service key and upsert", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await createSupabaseStorage({ ...opts, fetch: f }).put("p/q r.pdf", bytes("x"));
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://abc.supabase.co/storage/v1/object/documents/p/q%20r.pdf");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer service-key");
    expect(init.headers["x-upsert"]).toBe("true");
  });

  it("creates the bucket when the first upload says it is missing, then retries", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"Bucket not found"}', { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await createSupabaseStorage({ ...opts, fetch: f }).put("k.pdf", bytes("x"));
    expect(f).toHaveBeenCalledTimes(3);
    expect(f.mock.calls[1]![0]).toBe("https://abc.supabase.co/storage/v1/bucket");
    expect(JSON.parse(f.mock.calls[1]![1].body)).toMatchObject({ id: "documents", public: false });
  });

  it("treats an existing bucket as fine", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response('{"error":"already exists"}', { status: 409 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(
      createSupabaseStorage({ ...opts, fetch: f }).put("k.pdf", bytes("x")),
    ).resolves.toBeUndefined();
  });

  it("reads bytes back and reports a missing object as null", async () => {
    const found = vi.fn().mockResolvedValue(new Response("pdf-bytes"));
    const s = createSupabaseStorage({ ...opts, fetch: found });
    expect((await s.get("k.pdf"))?.toString()).toBe("pdf-bytes");
    expect(found.mock.calls[0]![0]).toContain("/object/authenticated/documents/k.pdf");

    const missing = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await createSupabaseStorage({ ...opts, fetch: missing }).get("nope")).toBeNull();
  });

  it("surfaces real failures instead of hiding them", async () => {
    const f = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    const s = createSupabaseStorage({ ...opts, fetch: f });
    await expect(s.get("k")).rejects.toThrow("Storage read failed (500)");
    await expect(s.delete("k")).rejects.toThrow("Storage delete failed (500)");
  });

  it("refuses keys that climb out or are empty", async () => {
    const f = vi.fn();
    const s = createSupabaseStorage({ ...opts, fetch: f });
    await expect(s.put("../x", bytes("x"))).rejects.toThrow("Invalid storage key");
    await expect(s.get("a//b")).rejects.toThrow("Invalid storage key");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("storageFromEnv", () => {
  it("uses Supabase when both variables are set", () => {
    const s = storageFromEnv({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "k",
    });
    expect(s).toBeDefined();
  });

  it("falls back to local disk when running locally", () => {
    expect(() => storageFromEnv({})).not.toThrow();
  });

  it("refuses to fall back to local disk on Vercel", () => {
    expect(() => storageFromEnv({ VERCEL: "1" })).toThrow("File storage isn't configured");
  });
});
