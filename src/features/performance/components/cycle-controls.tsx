"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, MessagesSquare, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";

import { advanceCycle, requestFeedback, saveCycle } from "../actions";
import { CYCLE_META, nextCycleStatus, type CycleStatus } from "../logic/goals";
import { cycleSchema, type CycleInput } from "../schemas";

export function NewCycleButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<CycleInput, unknown, z.output<typeof cycleSchema>>({
    resolver: zodResolver(cycleSchema),
    defaultValues: {
      name: "",
      periodStart: "",
      periodEnd: "",
      selfReviewDue: "",
      managerReviewDue: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async () => {
    const r = await saveCycle(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof CycleInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Cycle not created", { description: r.error });
      return;
    }
    toast.success("Cycle created", { description: "It stays private until you start it." });
    setOpen(false);
    form.reset();
    router.push(`/performance/cycles/${r.data.id}`);
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New cycle
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader
            title="New review cycle"
            description="Starting it later creates everyone's reviews."
          />
          <form onSubmit={submit} noValidate className="contents">
            <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name?.message} className="sm:col-span-2">
                <Input placeholder="H1 2027" {...form.register("name")} />
              </Field>
              <Field label="Period starts" error={errors.periodStart?.message}>
                <Input type="date" {...form.register("periodStart")} />
              </Field>
              <Field label="Period ends" error={errors.periodEnd?.message}>
                <Input type="date" {...form.register("periodEnd")} />
              </Field>
              <Field label="Self reviews due" error={errors.selfReviewDue?.message}>
                <Input type="date" {...form.register("selfReviewDue")} />
              </Field>
              <Field label="Manager reviews due" error={errors.managerReviewDue?.message}>
                <Input type="date" {...form.register("managerReviewDue")} />
              </Field>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Create cycle
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

const ADVANCE_COPY: Partial<Record<CycleStatus, { button: string; confirm: string }>> = {
  DRAFT: {
    button: "Start cycle",
    confirm: "Everyone gets a self review to write, and managers get a review of each report.",
  },
  SELF_REVIEW: {
    button: "Open manager reviews",
    confirm: "Managers can start writing. People can still finish their own reviews.",
  },
  MANAGER_REVIEW: {
    button: "Move to calibration",
    confirm:
      "Writing closes and the people team compares ratings across teams. Nothing is shared yet.",
  },
  CALIBRATION: {
    button: "Close and share results",
    confirm: "Everyone sees their ratings and their manager's review. This can't be undone.",
  },
};

export function AdvanceCycleButton({ cycleId, status }: { cycleId: string; status: CycleStatus }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const copy = ADVANCE_COPY[status];
  const next = nextCycleStatus(status);
  if (!copy || !next) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {copy.button} <ArrowRight aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader
            title={`${copy.button}?`}
            description={`Moves from ${CYCLE_META[status].label} to ${CYCLE_META[next].label}. ${copy.confirm}`}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await advanceCycle({ cycleId });
                  if (!r.ok) {
                    toast.error("Couldn't move the cycle", { description: r.error });
                    return;
                  }
                  setOpen(false);
                  toast.success(`Now in ${CYCLE_META[r.data.status].label.toLowerCase()}`);
                  router.refresh();
                })
              }
            >
              {copy.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Peer = { id: string; name: string; title: string; avatarUrl: string | null };

/** Pick colleagues to ask for feedback about someone. Each gets a short review to write. */
export function RequestFeedback({
  cycleId,
  reviewee,
  peers,
}: {
  cycleId: string;
  reviewee: { id: string; name: string };
  peers: Peer[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [q, setQ] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, startTransition] = React.useTransition();
  const needle = q.trim().toLowerCase();
  const others = peers.filter((p) => p.id !== reviewee.id);
  const shown = (
    needle ? others.filter((p) => `${p.name} ${p.title}`.toLowerCase().includes(needle)) : others
  ).slice(0, 30);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Ask for feedback about ${reviewee.name}`}
      >
        <MessagesSquare aria-hidden /> Ask for feedback
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader
            title={`Feedback about ${reviewee.name}`}
            description="Pick up to five colleagues. What they write reaches the subject without their names."
          />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await requestFeedback({
                  cycleId,
                  revieweeId: reviewee.id,
                  fromIds: picked,
                });
                if (!r.ok) {
                  setError(r.fieldErrors?.fromIds?.[0] ?? r.error);
                  return;
                }
                toast.success(`Asked ${r.data.asked} ${r.data.asked === 1 ? "person" : "people"}`);
                setOpen(false);
                setPicked([]);
                setError(undefined);
                router.refresh();
              });
            }}
          >
            <DialogBody className="grid gap-3">
              <Input
                type="search"
                aria-label="Search colleagues"
                placeholder="Search colleagues"
                leadingIcon={<Search aria-hidden />}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <ul className="max-h-64 overflow-y-auto rounded-control border border-hairline">
                {shown.map((p) => (
                  <li key={p.id} className="border-b border-hairline last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                      <Checkbox
                        checked={picked.includes(p.id)}
                        disabled={!picked.includes(p.id) && picked.length >= 5}
                        onCheckedChange={(v) =>
                          setPicked((cur) =>
                            v === true ? [...cur, p.id] : cur.filter((x) => x !== p.id),
                          )
                        }
                      />
                      <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{p.name}</span>
                        <span className="block truncate text-small text-ink-muted">{p.title}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {error && (
                <p role="alert" className="text-small font-medium text-danger">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Send {picked.length > 0 ? `to ${picked.length}` : "requests"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
