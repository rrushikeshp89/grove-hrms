"use client";

import { FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

import { uploadDocument } from "../actions";
import {
  ACCEPT,
  CATEGORY_META,
  MAX_UPLOAD_BYTES,
  VISIBILITY_LABELS,
  formatBytes,
  uploadProblem,
  type Category,
} from "../logic/rules";

const OWN: Category[] = ["ID_PROOF", "CONTRACT", "CERTIFICATE", "OTHER"];

/**
 * Add a file. Everyone can add to their own folder; the people team can also
 * choose someone else's folder or the company policy library. The file is
 * checked in the browser first so mistakes are caught before the upload.
 */
export function UploadSheet({
  manage,
  people,
  defaultTarget = "self",
}: {
  manage: boolean;
  people: { id: string; name: string; title: string }[];
  defaultTarget?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState<Category>("OTHER");
  const [target, setTarget] = React.useState(defaultTarget);
  const [visibility, setVisibility] = React.useState<"PRIVATE" | "HR_ONLY">("PRIVATE");
  const [file, setFile] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const policy = target === "policy";

  function onFile(f: File | null) {
    setFile(f);
    if (!f) return;
    const problem = uploadProblem(f);
    setErrors((e) => ({ ...e, file: problem ?? "" }));
    // A file name makes a decent starting title.
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrors({ file: "Choose a file" });
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    fd.set("category", policy ? "POLICY" : category);
    fd.set("target", target);
    fd.set("visibility", policy ? "COMPANY" : visibility);
    fd.set("file", file);
    startTransition(async () => {
      const r = await uploadDocument(fd);
      if (!r.ok) {
        const next: Record<string, string> = {};
        for (const [f, m] of Object.entries(r.fieldErrors ?? {})) next[f] = m[0]!;
        setErrors(next);
        if (!r.fieldErrors) toast.error("Upload failed", { description: r.error });
        return;
      }
      toast.success("Document added");
      setOpen(false);
      setTitle("");
      setFile(null);
      setErrors({});
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload aria-hidden /> Upload
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader
            title="Upload a document"
            description={`PDF, image, Word, Excel or text, up to ${formatBytes(MAX_UPLOAD_BYTES)}.`}
          />
          <form onSubmit={submit} noValidate className="contents">
            <SheetBody className="grid content-start gap-4">
              <Field label="File" error={errors.file}>
                <Input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              {file && !errors.file && (
                <p className="flex items-center gap-2 text-small text-ink-muted">
                  <FileUp className="size-4" aria-hidden /> {file.name} · {formatBytes(file.size)}
                </p>
              )}
              <Field label="Name" error={errors.title}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              {manage && (
                <Field label="Add to">
                  <Combobox
                    value={target}
                    onChange={(v) => setTarget(v ?? "self")}
                    searchPlaceholder="Search people"
                    options={[
                      { value: "self", label: "My folder" },
                      {
                        value: "policy",
                        label: "Company policy library",
                        hint: "Visible to everyone",
                      },
                      ...people.map((p) => ({ value: p.id, label: p.name, hint: p.title })),
                    ]}
                  />
                </Field>
              )}
              {!policy && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category" error={errors.category}>
                    <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OWN.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORY_META[c].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {manage && target !== "self" ? (
                    <Field label="Who can open it">
                      <Select
                        value={visibility}
                        onValueChange={(v) => setVisibility(v as "PRIVATE" | "HR_ONLY")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["PRIVATE", "HR_ONLY"] as const).map((v) => (
                            <SelectItem key={v} value={v}>
                              {VISIBILITY_LABELS[v]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                    <p className="self-end pb-2 text-small text-ink-muted">
                      Only you and the people team can open this.
                    </p>
                  )}
                </div>
              )}
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                <Upload aria-hidden /> Upload
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
