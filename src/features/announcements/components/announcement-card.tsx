"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Eye,
  Heart,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  PartyPopper,
  Pin,
  ThumbsUp,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import { deleteAnnouncement, markRead, toggleReaction, whoHasntRead } from "../actions";
import { REACTIONS, REACTION_LABELS, type ReactionKind } from "../logic/content";
import type { AnnouncementCard as Announcement } from "../queries";
import { RichText } from "./rich-text";

const ICONS: Record<ReactionKind, LucideIcon> = {
  like: ThumbsUp,
  celebrate: PartyPopper,
  love: Heart,
  insight: Lightbulb,
};

/** Marks the card read once it has been mostly on screen for a moment. */
function useReadOnView(id: string, alreadyRead: boolean, onRead: () => void) {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || alreadyRead) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting) {
          timer = setTimeout(async () => {
            const r = await markRead({ announcementId: id });
            if (r.ok && r.data.recorded) onRead();
            observer.disconnect();
          }, 1200);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [id, alreadyRead, onRead]);
  return ref;
}

export function AnnouncementCard({
  item,
  canPublish,
}: {
  item: Announcement;
  canPublish: boolean;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const [read, setRead] = React.useState(item.read);
  const [mine, setMine] = React.useState<ReactionKind[]>(item.mine);
  const [counts, setCounts] = React.useState(item.reactions);
  const [removing, setRemoving] = React.useState(false);
  const [unread, setUnread] = React.useState<string[] | null>(null);
  const [, startTransition] = React.useTransition();
  const ref = useReadOnView(item.id, read, () => setRead(true));

  function react(kind: ReactionKind) {
    const on = !mine.includes(kind);
    setMine((m) => (on ? [...m, kind] : m.filter((k) => k !== kind)));
    setCounts((c) => ({ ...c, [kind]: Math.max(0, (c[kind] ?? 0) + (on ? 1 : -1)) }));
    startTransition(async () => {
      const r = await toggleReaction({ announcementId: item.id, kind });
      if (!r.ok) {
        setMine(item.mine);
        setCounts(item.reactions);
        toast.error("Couldn't save your reaction", { description: r.error });
      }
    });
  }

  const published = item.publishedAt ? new Date(item.publishedAt) : null;
  const stats = item.stats;

  return (
    <article ref={ref} aria-labelledby={`a-${item.id}`}>
      <Card className={cn("flex flex-col gap-4 p-6", item.pinned && "border-accent/30")}>
        <header className="flex items-start gap-3">
          <Avatar name={item.author.name} src={item.author.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-small text-ink-muted">
              <span className="font-medium text-ink">{item.author.name}</span>
              <span>{item.author.title}</span>
              {published && (
                <time dateTime={item.publishedAt!} title={format(published, "d MMMM yyyy, HH:mm")}>
                  ·{" "}
                  {mounted
                    ? formatDistanceToNowStrict(published, { addSuffix: true })
                    : format(published, "d MMM yyyy")}
                </time>
              )}
            </p>
            <h2
              id={`a-${item.id}`}
              className="mt-1 font-display-soft text-title font-medium text-ink"
            >
              {!read && (
                <span
                  className="mr-2 inline-block size-2 -translate-y-1 rounded-full bg-accent"
                  role="img"
                  aria-label="Unread"
                />
              )}
              {item.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              {item.pinned && (
                <Badge tone="accent">
                  <Pin aria-hidden /> Pinned
                </Badge>
              )}
              {item.audience.length > 0 && (
                <Badge>
                  <Users aria-hidden /> {item.audience.join(", ")}
                </Badge>
              )}
              {!item.publishedAt && <Badge tone="warning">Draft</Badge>}
            </p>
          </div>
          {canPublish && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.title}`}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/announcements/${item.id}/edit`}>
                    <Pencil aria-hidden /> Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRemoving(true)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <RichText doc={item.body} />

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          {item.publishedAt ? (
            <div
              role="group"
              aria-label="Reactions"
              className="flex flex-wrap items-center gap-1.5"
            >
              {REACTIONS.map((kind) => {
                const Icon = ICONS[kind];
                const active = mine.includes(kind);
                const n = counts[kind] ?? 0;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${REACTION_LABELS[kind]}${n ? `, ${n}` : ""}`}
                    onClick={() => react(kind)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-small transition-colors duration-150",
                      active
                        ? "border-accent bg-accent-subtle text-accent"
                        : "border-hairline text-ink-muted hover:border-border-strong hover:text-ink",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {n > 0 && <span className="num">{n}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          {stats && item.publishedAt && (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const r = await whoHasntRead({ announcementId: item.id });
                  if (r.ok) setUnread(r.data.names);
                  else toast.error("Couldn't load readers", { description: r.error });
                })
              }
              className="inline-flex items-center gap-1.5 text-small text-ink-muted hover:text-ink"
            >
              <Eye className="size-4" aria-hidden />
              Read by <span className="num font-medium text-ink">{stats.readCount}</span> of{" "}
              <span className="num">{stats.audienceSize}</span>
            </button>
          )}
        </footer>
      </Card>

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent size="sm">
          <DialogHeader
            title="Delete this announcement?"
            description="It disappears for everyone, along with its reactions."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteAnnouncement({ announcementId: item.id });
                  if (!r.ok) toast.error("Couldn't delete", { description: r.error });
                  else {
                    toast.success("Announcement deleted");
                    setRemoving(false);
                    router.refresh();
                  }
                })
              }
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unread !== null} onOpenChange={(o) => !o && setUnread(null)}>
        <DialogContent size="sm">
          <DialogHeader
            title="Who hasn't read it"
            description={
              unread?.length === 0
                ? "Everyone in the audience has read it."
                : `${unread?.length ?? 0} people`
            }
          />
          {unread && unread.length > 0 && (
            <ul className="max-h-72 overflow-y-auto px-6 pb-5 text-body text-ink">
              {unread.map((n) => (
                <li key={n} className="border-b border-hairline py-1.5 last:border-0">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
