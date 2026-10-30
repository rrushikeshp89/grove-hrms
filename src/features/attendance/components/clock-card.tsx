"use client";

import { CalendarHeart, LogIn, LogOut, Palmtree, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { HoldButton } from "@/components/ui/hold-button";
import { Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { useMounted } from "@/hooks/use-mounted";
import { clockTime } from "@/lib/tz";

import { clockInOrOut } from "../actions";
import { formatDuration } from "../logic/evaluate";
import type { TodayState } from "../queries";

function useNow(intervalMs: number, enabled: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [enabled, intervalMs]);
  return now;
}

/**
 * The tactile clock: hold to clock in, hold again to clock out. The card
 * updates immediately and rolls back if the server disagrees.
 */
export function ClockCard({ today }: { today: TodayState }) {
  const router = useRouter();
  const mounted = useMounted();
  const [state, setState] = React.useState({ in: today.clockInAt, out: today.clockOutAt });
  const [pending, startTransition] = React.useTransition();
  const working = !!state.in && !state.out;
  const now = useNow(30_000, working);
  const tz = today.tz;

  const fullDayLeave = today.leave?.portion === 1;
  const restDay = !today.workDay || !!today.holiday;

  function onConfirm() {
    const before = state;
    const stamp = new Date().toISOString();
    setState(working ? { ...state, out: stamp } : { in: stamp, out: null });
    startTransition(async () => {
      const result = await clockInOrOut({
        source: matchMedia("(pointer: coarse)").matches ? "MOBILE" : "WEB",
      });
      if (!result.ok) {
        setState(before);
        toast.error(working ? "Couldn't clock you out" : "Couldn't clock you in", {
          description: result.error,
        });
        return;
      }
      const at = clockTime(new Date(result.data.at), tz);
      if (result.data.action === "in") {
        const late = result.data.lateByMinutes ?? 0;
        setState({ in: result.data.at, out: null });
        toast.success(`Clocked in at ${at}`, {
          description: late
            ? `${formatDuration(late)} after the shift started.`
            : "Right on time. Have a good day.",
        });
      } else {
        setState((s) => ({ ...s, out: result.data.at }));
        toast.success(`Clocked out at ${at}`, {
          description: `${formatDuration(result.data.workedMinutes ?? 0)} today. See you tomorrow.`,
        });
      }
      router.refresh();
    });
  }

  const elapsed = state.in
    ? Math.max(
        0,
        Math.round(((state.out ? Date.parse(state.out) : now) - Date.parse(state.in)) / 60000),
      )
    : 0;

  return (
    <Card className="flex flex-col items-center gap-5 px-6 py-7 text-center">
      <div>
        <p className="eyebrow">Today</p>
        <p className="mt-1 text-small text-ink-muted">
          General shift ·{" "}
          <span className="font-mono num">
            {today.schedule.startTime}–{today.schedule.endTime}
          </span>
        </p>
      </div>

      {fullDayLeave ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="grid size-16 place-items-center rounded-full bg-highlight-subtle text-highlight-ink">
            <Palmtree className="size-7" aria-hidden />
          </span>
          <p className="text-heading font-semibold text-ink">
            You&apos;re on {today.leave!.type.toLowerCase()}
          </p>
          <p className="text-small text-ink-muted">Nothing to clock today. Enjoy the time off.</p>
        </div>
      ) : state.out ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="grid size-16 place-items-center rounded-full bg-success-subtle text-success">
            <CalendarHeart className="size-7" aria-hidden />
          </span>
          <p className="font-display-soft num text-display font-medium text-ink">
            {formatDuration(elapsed)}
          </p>
          <p className="text-small text-ink-muted">
            {clockTime(new Date(state.in!), tz)} to {clockTime(new Date(state.out), tz)}.
            That&apos;s a wrap for today.
          </p>
        </div>
      ) : (
        <>
          <HoldButton
            label={working ? "Clock out" : "Clock in"}
            sublabel={working ? (mounted ? formatDuration(elapsed) : "") : "Hold"}
            icon={working ? <LogOut aria-hidden /> : <LogIn aria-hidden />}
            tone={working ? "neutral" : "accent"}
            onConfirm={onConfirm}
            disabled={pending}
          />
          <p className="max-w-60 text-small text-ink-muted" aria-live="polite">
            {working ? (
              <>
                In since{" "}
                <span className="font-mono num text-ink">{clockTime(new Date(state.in!), tz)}</span>
                {today.lateByMinutes > 0 && ` · ${formatDuration(today.lateByMinutes)} late`}
              </>
            ) : restDay ? (
              <span className="inline-flex items-center gap-1.5">
                <PartyPopper className="size-4" aria-hidden />
                {today.holiday ? `${today.holiday} today.` : "It's the weekend."} Clock in only if
                you&apos;re working.
              </span>
            ) : (
              "Press and hold to clock in, or focus the button and press Enter."
            )}
          </p>
          {today.leave && today.leave.portion < 1 && (
            <Badge tone="highlight">Half-day {today.leave.type.toLowerCase()}</Badge>
          )}
        </>
      )}
    </Card>
  );
}
