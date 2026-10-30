"use client";

import { UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
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

import { rejectCandidate } from "../actions";

/** Passing on someone always records why, for the team and for next time. */
export function RejectDialog({
  candidate,
  onOpenChange,
}: {
  candidate: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, startTransition] = React.useTransition();

  function close(open: boolean) {
    if (!open) {
      setReason("");
      setError(undefined);
    }
    onOpenChange(open);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    startTransition(async () => {
      const r = await rejectCandidate({ candidateId: candidate.id, reason });
      if (!r.ok) {
        setError(r.fieldErrors?.reason?.[0] ?? r.error);
        return;
      }
      toast.success(`${candidate.name} won't move forward`);
      close(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={!!candidate} onOpenChange={close}>
      <DialogContent size="sm">
        <DialogHeader
          title={`Not moving forward with ${candidate?.name ?? ""}?`}
          description="The reason stays on their profile for the hiring team."
        />
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <Field label="Why not?" error={error}>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Strong skills, but we need more backend depth at this level."
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Keep them
            </Button>
            <Button type="submit" variant="destructive" loading={pending}>
              <UserX aria-hidden /> Not moving forward
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
