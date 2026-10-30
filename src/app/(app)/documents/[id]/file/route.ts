import { isInline } from "@/features/documents/logic/rules";
import { openableDocument } from "@/features/documents/queries";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/server/session";

/** Streams a stored document after checking this person may open it. */
export async function GET(_req: Request, ctx: RouteContext<"/documents/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to open documents.", { status: 401 });
  const { id } = await ctx.params;
  const doc = await openableDocument(user, id);
  // The same answer for "missing" and "not yours", so ids can't be probed.
  if (!doc) return new Response("Document not found.", { status: 404 });
  const data = await storage.get(doc.storageKey);
  if (!data) return new Response("The file is missing from storage.", { status: 404 });

  const inline = isInline(doc.mimeType);
  const headers = new Headers({
    "Content-Type": doc.mimeType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${doc.fileName}"`,
    "Content-Length": String(data.byteLength),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  // PDFs open in the browser's own viewer, which a strict policy would block; it
  // already runs them sandboxed. Everything else gets a policy that allows nothing.
  if (doc.mimeType !== "application/pdf") {
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
  }
  return new Response(new Uint8Array(data), { headers });
}
