"use client";

import { CheckCheck, RefreshCw, Send, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";

import { finalizeRun, regenerateRun, returnRun, submitRun } from "../actions";

/**
 * The buttons for where a run is in its life. A draft can be refreshed or
 * sent for review; a run in review can be sent back with a note or finalized
 * by someone other than the preparer.
 */
export function RunActions({
  runId,
  status,
  label,
  mine,
}: {
  runId: string;
  status: "DRAFT" | "IN_REVIEW" | "FINALIZED";
  label: string;
  /** Whether the viewer prepared this run, and so can't finalize it. */
  mine: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [sendingBack, setSendingBack] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();

  function run<T>(
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    ok: (d: T) => void,
  ) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error("That didn't work", { description: r.error });
        return;
      }
      ok(r.data);
      router.refresh();
    });
  }

  if (status === "FINALIZED") return null;

  return (
    <>
      {status === "DRAFT" ? (
        <>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () => regenerateRun({ runId }),
                (d) =>
                  toast.success("Draft refreshed", {
                    description: `${d.people} payslips recalculated.`,
                  }),
              )
            }
          >
            <RefreshCw aria-hidden /> Recalculate
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              run(
                () => submitRun({ runId }),
                () =>
                  toast.success("Sent for review", {
                    description: "Someone else will check and finalize it.",
                  }),
              )
            }
          >
            <Send aria-hidden /> Send for review
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={() => setSendingBack(true)}>
            <Undo2 aria-hidden /> Send back
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={mine}>
            <CheckCheck aria-hidden /> Finalize
          </Button>
          {mine && (
            <p className="basis-full text-small text-ink-muted sm:text-right">
              You prepared this run, so someone else needs to finalize it.
            </p>
          )}
        </>
      )}

      <Dialog open={sendingBack} onOpenChange={setSendingBack}>
        <DialogContent size="sm">
          <DialogHeader
            title="Send back to draft?"
            description="It returns to the preparer, who can recalculate and send it again."
          />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await returnRun({ runId, note });
                if (!r.ok) {
                  setError(r.fieldErrors?.note?.[0] ?? r.error);
                  return;
                }
                setSendingBack(false);
                setNote("");
                setError(undefined);
                toast.success("Sent back to draft");
                router.refresh();
              });
            }}
          >
            <DialogBody>
              <Field label="What needs another look?" error={error}>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSendingBack(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Send back
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent size="sm">
          <DialogHeader
            title={`Finalize ${label}?`}
            description="Payslips become visible to everyone in this run and can no longer change."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () => finalizeRun({ runId }),
                  () => {
                    setConfirming(false);
                    celebrate();
                    toast.success(`${label} is final`, {
                      description: "Payslips are now available to everyone.",
                    });
                  },
                )
              }
            >
              <CheckCheck aria-hidden /> Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
