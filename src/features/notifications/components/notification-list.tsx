"use client";

import { Check, CheckCheck, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import {
  markAllNotificationsRead,
  markNotificationUnread,
  markNotificationsRead,
} from "../actions";
import { kindMeta } from "../kinds";
import { Ago } from "./notification-bell";

type Item = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

/** The notifications page: read state changes land at once and settle with the server. */
export function NotificationList({ items, unread }: { items: Item[]; unread: number }) {
  const router = useRouter();
  const [read, setRead] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.read])),
  );
  const [, startTransition] = React.useTransition();
  const unreadNow =
    items.filter((i) => !read[i.id]).length +
    Math.max(0, unread - items.filter((i) => !i.read).length);

  function toggle(n: Item) {
    const nowRead = !read[n.id];
    setRead((r) => ({ ...r, [n.id]: nowRead }));
    startTransition(async () => {
      const r = nowRead
        ? await markNotificationsRead({ ids: [n.id] })
        : await markNotificationUnread({ id: n.id });
      if (!r.ok) {
        setRead((cur) => ({ ...cur, [n.id]: !nowRead }));
        toast.error("Couldn't update that", { description: r.error });
      } else router.refresh();
    });
  }

  function open(n: Item) {
    if (read[n.id]) return;
    setRead((r) => ({ ...r, [n.id]: true }));
    void markNotificationsRead({ ids: [n.id] });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <p className="text-small text-ink-muted" aria-live="polite">
          {unreadNow > 0 ? `${unreadNow} unread` : "Nothing unread"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={unreadNow === 0}
          onClick={() =>
            startTransition(async () => {
              setRead(Object.fromEntries(items.map((i) => [i.id, true])));
              const r = await markAllNotificationsRead({});
              if (r.ok) {
                toast.success("All caught up");
                router.refresh();
              }
            })
          }
        >
          <CheckCheck aria-hidden /> Mark all as read
        </Button>
      </div>
      <ul>
        {items.map((n) => {
          const meta = kindMeta(n.kind);
          const Kind = meta.icon;
          const isRead = read[n.id];
          return (
            <li
              key={n.id}
              className="flex items-start gap-3 border-b border-hairline px-5 py-4 last:border-0"
            >
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                  isRead ? "bg-surface-sunken text-ink-subtle" : "bg-accent-subtle text-accent",
                )}
              >
                <Kind className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => open(n)}
                      className={cn(
                        "text-body hover:text-accent",
                        isRead ? "text-ink-muted" : "font-medium text-ink",
                      )}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "text-body",
                        isRead ? "text-ink-muted" : "font-medium text-ink",
                      )}
                    >
                      {n.title}
                    </span>
                  )}
                  {!isRead && (
                    <span
                      className="size-2 rounded-full bg-accent"
                      role="img"
                      aria-label="Unread"
                    />
                  )}
                </p>
                {n.body && <p className="mt-0.5 text-small text-ink-muted">{n.body}</p>}
                <p className="mt-1 flex items-center gap-2 text-caption text-ink-subtle">
                  <Badge>{meta.label}</Badge>
                  <Ago iso={n.createdAt} />
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-ink-subtle"
                onClick={() => toggle(n)}
                aria-label={isRead ? `Mark "${n.title}" as unread` : `Mark "${n.title}" as read`}
              >
                {isRead ? <Circle aria-hidden /> : <Check aria-hidden />}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
