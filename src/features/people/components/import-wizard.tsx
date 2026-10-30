"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { importEmployees, previewEmployeeImport } from "../import-actions";
import { MAX_IMPORT_ROWS } from "../import-logic";

type Preview = {
  problems: string[];
  summary: { total: number; ready: number; problems: number };
  rows: {
    line: number;
    errors: string[];
    display: {
      name: string;
      email: string;
      department: string;
      designation: string;
      location: string;
      manager: string;
      employmentType: string;
      joinDate: string;
    };
  }[];
};

type Done = { created: { name: string; code: string }[]; skipped: number };

/**
 * Three steps: choose a file, read what Grove makes of it, then confirm.
 * Nothing is written until the last step, and the server checks the file
 * again then, so what you previewed is what gets imported.
 */
export function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = React.useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [done, setDone] = React.useState<Done | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const input = React.useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    if (input.current) input.current.value = "";
  }

  async function read(f: File | undefined) {
    if (!f) return;
    setError(null);
    setPreview(null);
    if (!/\.csv$/i.test(f.name)) {
      setError("Choose a .csv file. In Excel or Sheets, use Save as, then CSV.");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    startTransition(async () => {
      const r = await previewEmployeeImport({ csv: text });
      if (!r.ok) setError(r.fieldErrors?.csv?.[0] ?? r.error);
      else setPreview(r.data);
    });
  }

  function confirm() {
    if (!file) return;
    startTransition(async () => {
      const r = await importEmployees({ csv: file.text });
      if (!r.ok) {
        toast.error("Nothing was imported", { description: r.error });
        return;
      }
      setDone(r.data);
      toast.success(
        `${r.data.created.length} ${r.data.created.length === 1 ? "person" : "people"} added`,
      );
      router.refresh();
    });
  }

  if (done) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success-subtle text-success">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          <h2 className="font-display-soft text-title font-medium text-ink">
            {done.created.length} {done.created.length === 1 ? "person" : "people"} added
          </h2>
          <p className="max-w-md text-body text-ink-muted">
            Their profiles are ready and onboarding has started.
            {done.skipped > 0 &&
              ` ${done.skipped} ${done.skipped === 1 ? "row was" : "rows were"} skipped because of problems.`}
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {done.created.map((c) => (
              <li key={c.code}>
                <Badge className="font-mono">
                  {c.code} · {c.name}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link href="/people">See the directory</Link>
            </Button>
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!preview && (
        <Card>
          <CardHeader
            title="1. Choose a file"
            description={`A CSV with one person per row, up to ${MAX_IMPORT_ROWS} at a time.`}
            action={
              <Button asChild variant="secondary" size="sm">
                <a href="/people/import/template" download>
                  <Download aria-hidden /> Template
                </a>
              </Button>
            }
          />
          <CardBody>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void read(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragging
                  ? "border-accent bg-accent-subtle/50"
                  : "border-border-strong hover:border-ink-subtle",
              )}
            >
              <FileSpreadsheet className="size-8 text-ink-subtle" strokeWidth={1.5} aria-hidden />
              <span className="text-body font-medium text-ink">
                {pending ? "Reading your file…" : "Drop a CSV here, or choose one"}
              </span>
              <span className="text-small text-ink-muted">
                Managers can be someone already in Grove, or a row above.
              </span>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                className="sr-only"
                onChange={(e) => void read(e.target.files?.[0])}
              />
            </label>
            {error && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 text-small font-medium text-danger"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {preview && (
        <Card className="overflow-hidden">
          <CardHeader
            title="2. Check what we found"
            description={file?.name}
            action={
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw aria-hidden /> Choose another file
              </Button>
            }
          />
          {preview.problems.length > 0 ? (
            <CardBody>
              <ul className="flex flex-col gap-1.5" role="alert">
                {preview.problems.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-body text-danger">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {p}
                  </li>
                ))}
              </ul>
            </CardBody>
          ) : (
            <>
              <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-hairline">
                <p className="text-body text-ink">
                  <span className="num font-semibold">{preview.summary.ready}</span> of{" "}
                  <span className="num">{preview.summary.total}</span> rows are ready
                </p>
                {preview.summary.problems > 0 && (
                  <Badge tone="warning">
                    {preview.summary.problems} with problems will be skipped
                  </Badge>
                )}
              </CardBody>
              <div
                className="max-h-[28rem] overflow-auto"
                tabIndex={0}
                role="region"
                aria-label="Rows in the file"
              >
                <table className="w-full min-w-[46rem] text-left text-body">
                  <caption className="sr-only">
                    Rows in the file and whether each can be imported
                  </caption>
                  <thead className="sticky top-0 bg-surface-sunken text-caption text-ink-muted">
                    <tr>
                      <th scope="col" className="h-10 px-4 font-medium">
                        Line
                      </th>
                      <th scope="col" className="px-3 font-medium">
                        Person
                      </th>
                      <th scope="col" className="px-3 font-medium">
                        Role
                      </th>
                      <th scope="col" className="px-3 font-medium">
                        Starts
                      </th>
                      <th scope="col" className="px-4 font-medium">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.line} className="border-t border-hairline align-top">
                        <td className="px-4 py-2.5 num text-ink-subtle">{r.line}</td>
                        <th scope="row" className="px-3 py-2.5 text-left font-normal">
                          <span className="block text-ink">{r.display.name || "(no name)"}</span>
                          <span className="block text-small text-ink-muted">{r.display.email}</span>
                        </th>
                        <td className="px-3 py-2.5 text-small text-ink-muted">
                          {r.display.designation}
                          <span className="block text-ink-subtle">{r.display.department}</span>
                        </td>
                        <td className="px-3 py-2.5 num text-small text-ink-muted">
                          {r.display.joinDate}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.errors.length === 0 ? (
                            <Badge tone="success">Ready</Badge>
                          ) : (
                            <ul className="flex flex-col gap-0.5">
                              {r.errors.map((e) => (
                                <li key={e} className="text-small text-danger">
                                  {e}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline">
                <p className="text-small text-ink-muted">
                  Each person gets an employee ID and an onboarding checklist. Nothing is added
                  until you confirm.
                </p>
                <Button onClick={confirm} loading={pending} disabled={preview.summary.ready === 0}>
                  <UserPlus aria-hidden /> Import {preview.summary.ready}{" "}
                  {preview.summary.ready === 1 ? "person" : "people"}
                </Button>
              </CardBody>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
