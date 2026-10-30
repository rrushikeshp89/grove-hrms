import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded files live. Everything goes through this small interface so
 * the backing store can change without touching callers: the local disk (dev,
 * tests and self-hosting), or a private Supabase Storage bucket when
 * `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (the Vercel deploy).
 *
 * Not marked server-only so the seed can write files too; never import it
 * from a client component. The service-role key must never reach the browser.
 */
export type Storage = {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
};

export const uploadRoot = () =>
  path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads"));

/** Resolves a key inside the upload folder, refusing anything that escapes it. */
function resolveKey(key: string) {
  const base = uploadRoot();
  const full = path.resolve(base, key);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export function createLocalStorage(): Storage {
  return {
    async put(key, data) {
      const file = resolveKey(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async get(key) {
      try {
        return await readFile(resolveKey(key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
  };
}

type SupabaseOptions = {
  url: string;
  serviceKey: string;
  bucket?: string;
  fetch?: typeof fetch;
};

/** Keys are folder-like paths; encode each segment and refuse anything that climbs out. */
function objectPath(key: string) {
  const parts = key.split("/");
  if (parts.some((p) => p === "" || p === "." || p === ".."))
    throw new Error("Invalid storage key");
  return parts.map(encodeURIComponent).join("/");
}

/**
 * Supabase Storage over its REST API, so the app needs no extra client
 * library. The bucket is private and created on first use; files are only
 * ever read back through the app, after its own access check.
 */
export function createSupabaseStorage({
  url,
  serviceKey,
  bucket = "documents",
  fetch: doFetch = fetch,
}: SupabaseOptions): Storage {
  const base = `${url.replace(/\/+$/, "")}/storage/v1`;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  let bucketReady = false;

  async function ensureBucket() {
    if (bucketReady) return;
    const res = await doFetch(`${base}/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    // 409 / "already exists" is the normal case after the first run.
    if (!res.ok && res.status !== 409 && !(await res.clone().text()).includes("already exists")) {
      throw new Error(`Storage bucket "${bucket}" could not be created (${res.status}).`);
    }
    bucketReady = true;
  }

  async function upload(key: string, data: Uint8Array) {
    return doFetch(`${base}/object/${bucket}/${objectPath(key)}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/octet-stream", "x-upsert": "true" },
      body: data as BodyInit,
    });
  }

  return {
    async put(key, data) {
      let res = await upload(key, data);
      if (!res.ok && !bucketReady) {
        await ensureBucket();
        res = await upload(key, data);
      }
      if (!res.ok) throw new Error(`Storage upload failed (${res.status}).`);
      bucketReady = true;
    },
    async get(key) {
      const res = await doFetch(`${base}/object/authenticated/${bucket}/${objectPath(key)}`, {
        headers,
      });
      // Supabase answers 400 or 404 for a missing object depending on version.
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`Storage read failed (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    },
    async delete(key) {
      const res = await doFetch(`${base}/object/${bucket}/${objectPath(key)}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok && res.status !== 404 && res.status !== 400) {
        throw new Error(`Storage delete failed (${res.status}).`);
      }
    },
  };
}

/** Picks the store from the environment. Exported for tests. */
export function storageFromEnv(env: Record<string, string | undefined> = process.env): Storage {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    return createSupabaseStorage({ url, serviceKey, bucket: env.SUPABASE_STORAGE_BUCKET });
  }
  // A serverless filesystem is read-only and per-instance: files would vanish.
  if (env.VERCEL) {
    throw new Error(
      "File storage isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
  }
  return createLocalStorage();
}

let current: Storage | undefined;
const resolve = () => (current ??= storageFromEnv());

/** Chosen on first use, so builds and pages that never touch files need no credentials. */
export const storage: Storage = {
  put: (key, data) => resolve().put(key, data),
  get: (key) => resolve().get(key),
  delete: (key) => resolve().delete(key),
};
