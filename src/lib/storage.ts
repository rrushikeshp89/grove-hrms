import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded files live. Everything goes through this small interface so
 * the backing store can change without touching callers: today it's the
 * local disk (dev, tests and self-hosting); a hosted object store is added
 * behind the same three calls when the app is deployed.
 *
 * Not marked server-only so the seed can write files too; never import it
 * from a client component.
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

const localDisk: Storage = {
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

export const storage: Storage = localDisk;
