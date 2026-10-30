"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Tooltip } from "@/components/ui/tooltip";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type NotificationItem,
} from "../actions";
import { kindMeta } from "../kinds";

const POLL_MS = 60_000;

/** Time since, once mounted (it depends on the viewer's clock). */
export function Ago({ iso, className }: { iso: string; className?: string }) {
  const mounted = useMounted();
  return (
    <time dateTime={iso} className={className}>
      {mounted ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : ""}
    </time>
  );
}

/**
 * The bell. It loads when the page does, again when you open it, and about
 * once a minute while the tab is visible, which is plenty for a work tool
 * without holding a connection open.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<{ unread: number; items: NotificationItem[] } | null>(
    null,
  );

  const refresh = React.useCallback(async () => {
    setState(await loadNotifications(8));
  }, []);

  React.useEffect(() => {
    // First load after mount, then on a timer while the tab is in view.
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const unread = state?.unread ?? 0;
  const Icon = unread > 0 ? BellRing : Bell;

  async function readAll() {
    setState((s) => (s ? { unread: 0, items: s.items.map((i) => ({ ...i, read: true })) } : s));
    await markAllNotificationsRead({});
    router.refresh();
  }

  function visit(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setState((s) =>
        s
          ? {
              unread: Math.max(0, s.unread - 1),
              items: s.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
            }
          : s,
      );
      void markNotificationsRead({ ids: [n.id] });
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refresh();
      }}
    >
      <Tooltip content="Notifications">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative grid size-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 num text-[10px] leading-4 font-semibold text-accent-fg"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <h2 className="text-body font-semibold text-ink">Notifications</h2>
          <button
            type="button"
            onClick={readAll}
            disabled={unread === 0}
            className="inline-flex items-center gap-1.5 text-small text-ink-muted hover:text-ink disabled:pointer-events-none disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" aria-hidden /> Mark all read
          </button>
        </div>
        {state === null ? (
          <p className="px-4 py-8 text-center text-small text-ink-muted">Loading…</p>
        ) : state.items.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-body font-medium text-ink">You&apos;re all caught up</p>
            <p className="mt-1 text-small text-ink-muted">
              Approvals, reminders and company news will show up here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[26rem] overflow-y-auto">
            {state.items.map((n) => {
              const meta = kindMeta(n.kind);
              const Kind = meta.icon;
              const row = (
                <>
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                      n.read ? "bg-surface-sunken text-ink-subtle" : "bg-accent-subtle text-accent",
                    )}
                  >
                    <Kind className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-body",
                        n.read ? "text-ink-muted" : "font-medium text-ink",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block truncate text-small text-ink-muted">{n.body}</span>
                    )}
                    <Ago iso={n.createdAt} className="block text-caption text-ink-subtle" />
                  </span>
                  {!n.read && (
                    <span
                      className="mt-2 size-2 shrink-0 rounded-full bg-accent"
                      role="img"
                      aria-label="Unread"
                    />
                  )}
                </>
              );
              return (
                <li key={n.id} className="border-b border-hairline last:border-0">
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => visit(n)}
                      className="flex gap-3 px-4 py-3 hover:bg-surface-hover"
                    >
                      {row}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => visit(n)}
                      className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-hover"
                    >
                      {row}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-hairline px-4 py-2.5 text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-small font-medium text-accent hover:underline"
          >
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
