"use client";

import { format } from "date-fns";
import { Download, ExternalLink, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";

import { deleteDocument } from "../actions";
import { CATEGORY_META, VISIBILITY_LABELS, formatBytes, isInline } from "../logic/rules";
import type { DocumentRow } from "../queries";

/** A folder or the policy library: open, download and (where allowed) delete. */
export function DocumentList({
  docs,
  showOwner = false,
}: {
  docs: DocumentRow[];
  showOwner?: boolean;
}) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<DocumentRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  return (
    <>
      <ul>
        {docs.map((d) => {
          const Icon = d.mimeType.startsWith("image/") ? ImageIcon : FileText;
          const inline = isInline(d.mimeType);
          return (
            <li
              key={d.id}
              className="flex flex-col gap-2 border-b border-hairline px-5 py-3.5 last:border-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-sunken text-ink-subtle">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-ink">{d.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-small text-ink-muted">
                    <Badge>{CATEGORY_META[d.category].label}</Badge>
                    <span className="num">{formatBytes(d.sizeBytes)}</span>
                    <span>{format(new Date(d.createdAt), "d MMM yyyy")}</span>
                    {showOwner && d.owner && <span>{d.owner}</span>}
                    {d.visibility === "HR_ONLY" && (
                      <span className="text-ink-subtle">{VISIBILITY_LABELS.HR_ONLY}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`/documents/${d.id}/file`}
                    {...(inline
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : { download: d.fileName })}
                    aria-label={`${inline ? "Open" : "Download"} ${d.title}`}
                  >
                    {inline ? <ExternalLink aria-hidden /> : <Download aria-hidden />}{" "}
                    {inline ? "Open" : "Download"}
                  </a>
                </Button>
                {d.canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-ink-subtle"
                    aria-label={`Delete ${d.title}`}
                    onClick={() => setRemoving(d)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent size="sm">
          <DialogHeader
            title="Delete this document?"
            description={removing ? `${removing.title} will be removed for good.` : undefined}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                removing &&
                startTransition(async () => {
                  const r = await deleteDocument({ documentId: removing.id });
                  if (!r.ok) {
                    toast.error("Couldn't delete", { description: r.error });
                    return;
                  }
                  toast.success("Document deleted");
                  setRemoving(null);
                  router.refresh();
                })
              }
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
