"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Laptop, Smartphone } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { revokeOtherSessions, revokeSession } from "@/features/auth/actions";
import { useMounted } from "@/hooks/use-mounted";
import { gentle } from "@/lib/motion";

export type SessionRow = {
  id: string;
  label: string;
  mobile: boolean;
  ip: string | null;
  lastActive: string;
  current: boolean;
};

export function SessionsList({ initial }: { initial: SessionRow[] }) {
  const [sessions, setSessions] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const mounted = useMounted();
  const others = sessions.filter((s) => !s.current).length;

  function revoke(row: SessionRow) {
    // Optimistic: the row leaves now and comes back if the server says no.
    setSessions((all) => all.filter((s) => s.id !== row.id));
    startTransition(async () => {
      const result = await revokeSession({ sessionId: row.id });
      if (!result.ok) {
        setSessions((all) => [...all, row]);
        toast.error("Couldn't sign that device out", { description: result.error });
      } else {
        toast.success(`Signed out ${row.label}`);
      }
    });
  }

  function revokeOthers() {
    const before = sessions;
    setSessions((all) => all.filter((s) => s.current));
    startTransition(async () => {
      const result = await revokeOtherSessions({});
      if (!result.ok) {
        setSessions(before);
        toast.error("Couldn't sign out other devices", { description: result.error });
      } else {
        toast.success(`Signed out ${result.data} other session${result.data === 1 ? "" : "s"}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-hairline rounded-card border border-hairline">
        <AnimatePresence initial={false}>
          {sessions.map((s) => {
            const Icon = s.mobile ? Smartphone : Laptop;
            return (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                transition={gentle}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-sunken text-ink-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink">
                      {s.label}
                      {s.current && <Badge tone="success">This device</Badge>}
                    </p>
                    <p className="text-small text-ink-subtle">
                      {s.ip && <span className="font-mono">{s.ip} · </span>}
                      Active{" "}
                      {mounted
                        ? `${formatDistanceToNowStrict(new Date(s.lastActive))} ago`
                        : "recently"}
                    </p>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(s)} disabled={pending}>
                      Sign out
                    </Button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {others > 0 && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={revokeOthers}
          disabled={pending}
        >
          Sign out of {others} other session{others === 1 ? "" : "s"}
        </Button>
      )}
    </div>
  );
}
