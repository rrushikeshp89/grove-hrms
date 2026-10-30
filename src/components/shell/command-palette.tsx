"use client";

import { Command } from "cmdk";
import {
  Briefcase,
  CornerDownLeft,
  FileText,
  Megaphone,
  Search,
  Target,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/primitives";
import { searchEverything } from "@/features/search/actions";
import { Highlight } from "@/features/search/components/highlight";
import type { HitKind, SearchHit } from "@/features/search/queries";
import { commandScore } from "@/lib/command-filter";
import { formatShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

import { useActions, useIsMac, type Action, type ActionGroup } from "./actions-provider";

const GROUP_ORDER: ActionGroup[] = ["Actions", "Navigate", "Preferences", "Help"];

export function Keycaps({ spec, className }: { spec: string; className?: string }) {
  const isMac = useIsMac();
  const steps = formatShortcut(spec, isMac);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {steps.map((caps, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-caption text-ink-subtle">then</span>}
          <span className="inline-flex gap-0.5">
            {caps.map((c) => (
              <Kbd key={c}>{c}</Kbd>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

const KINDS: { kind: HitKind; heading: string; icon: LucideIcon | null }[] = [
  { kind: "person", heading: "People", icon: null },
  { kind: "job", heading: "Jobs", icon: Briefcase },
  { kind: "candidate", heading: "Candidates", icon: UserSearch },
  { kind: "announcement", heading: "Announcements", icon: Megaphone },
  { kind: "goal", heading: "Goals", icon: Target },
  { kind: "policy", heading: "Policies", icon: FileText },
];

/** Server-side search across the app, debounced and cancelled when the query moves on. */
function useSearch(query: string, enabled: boolean) {
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [lastQuery, setLastQuery] = React.useState(query);
  const q = query.trim();
  if (q !== lastQuery) {
    setLastQuery(q);
    if (q.length < 2) setHits([]);
  }
  React.useEffect(() => {
    if (!enabled || q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await searchEverything(q);
      if (!cancelled) setHits(result);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, enabled]);
  return enabled ? hits : [];
}

export function CommandPalette({ peopleSearch = false }: { peopleSearch?: boolean }) {
  const { actions, paletteOpen, setPaletteOpen } = useActions();
  const [search, setSearch] = React.useState("");
  const hits = useSearch(search, peopleSearch && paletteOpen);
  const terms = search.trim().split(/\s+/).filter(Boolean);
  const router = useRouter();

  const groups = React.useMemo(() => {
    const visible = actions.filter((a) => !a.paletteHidden);
    return GROUP_ORDER.map((g) => ({
      group: g,
      items: visible.filter((a) => a.group === g),
    })).filter((g) => g.items.length > 0);
  }, [actions]);

  function run(action: Action) {
    setPaletteOpen(false);
    // Let the dialog close before navigating or opening another overlay.
    requestAnimationFrame(() => action.perform());
  }

  return (
    <DialogPrimitive.Root
      open={paletteOpen}
      onOpenChange={(open) => {
        setPaletteOpen(open);
        if (!open) setSearch("");
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2",
            "overflow-hidden rounded-overlay border border-hairline bg-surface shadow-lg outline-none",
            "data-[state=open]:animate-[dialog-in_200ms_var(--ease-out-soft)]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command loop label="Command palette" filter={commandScore}>
            <div className="flex items-center gap-3 border-b border-hairline px-4">
              <Search className="size-[18px] shrink-0 text-ink-subtle" aria-hidden />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={
                  peopleSearch
                    ? "Search people, jobs, policies, pages and actions…"
                    : "Search pages and actions…"
                }
                className="h-14 flex-1 bg-transparent text-heading text-ink outline-none placeholder:text-ink-subtle"
              />
              <Kbd className="hidden sm:inline-flex">Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,26rem)] scroll-py-2 overflow-y-auto p-2">
              <Command.Empty className="px-4 py-10 text-center">
                <p className="text-body text-ink">Nothing matches &ldquo;{search}&rdquo;</p>
                <p className="mt-1 text-small text-ink-muted">
                  {peopleSearch
                    ? "Try a colleague’s name, a policy title, or a page like “org chart”."
                    : "Try a page name like “components” or an action like “dark”."}
                </p>
              </Command.Empty>
              {KINDS.map(({ kind, heading, icon: KindIcon }) => {
                const items = hits.filter((h) => h.kind === kind);
                if (items.length === 0) return null;
                return (
                  <Command.Group
                    key={kind}
                    heading={heading}
                    className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:eyebrow"
                  >
                    {items.map((h) => (
                      <Command.Item
                        key={`${h.kind}:${h.id}`}
                        value={`${h.title} ${h.detail} ${h.code ?? ""}`}
                        // The server already matched these; keep them from being filtered out here.
                        keywords={terms}
                        onSelect={() => {
                          setPaletteOpen(false);
                          setSearch("");
                          router.push(h.href);
                        }}
                        className={cn(
                          "group flex h-12 cursor-default items-center gap-3 rounded-control px-2.5 text-body text-ink outline-none",
                          "data-[selected=true]:bg-surface-hover",
                        )}
                      >
                        {KindIcon ? (
                          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-hairline bg-surface text-ink-muted group-data-[selected=true]:border-accent/30 group-data-[selected=true]:text-accent">
                            <KindIcon className="size-4" strokeWidth={1.75} aria-hidden />
                          </span>
                        ) : (
                          <Avatar name={h.title} src={h.avatarUrl} size="sm" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            <Highlight text={h.title} query={search} />
                          </span>
                          <span className="block truncate text-caption text-ink-subtle">
                            <Highlight text={h.detail} query={search} />
                          </span>
                        </span>
                        {h.code && (
                          <span className="hidden font-mono text-caption text-ink-subtle sm:inline">
                            <Highlight text={h.code} query={search} />
                          </span>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              {groups.map(({ group, items }) => (
                <Command.Group
                  key={group}
                  heading={group}
                  className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:eyebrow"
                >
                  {items.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Command.Item
                        key={a.id}
                        value={a.label}
                        keywords={a.keywords}
                        onSelect={() => run(a)}
                        className={cn(
                          "group flex h-11 cursor-default items-center gap-3 rounded-control px-2.5 text-body text-ink outline-none",
                          "data-[selected=true]:bg-surface-hover",
                        )}
                      >
                        <span className="grid size-7 place-items-center rounded-sm border border-hairline bg-surface text-ink-muted group-data-[selected=true]:border-accent/30 group-data-[selected=true]:text-accent">
                          {Icon && <Icon className="size-4" aria-hidden />}
                        </span>
                        <span className="flex-1 truncate">{a.label}</span>
                        {a.hint && (
                          <span className="hidden text-small text-ink-subtle sm:inline">
                            {a.hint}
                          </span>
                        )}
                        {a.shortcut && (
                          <Keycaps spec={a.shortcut} className="hidden sm:inline-flex" />
                        )}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
            <div className="hidden items-center gap-4 border-t border-hairline bg-surface-sunken/60 px-4 py-2.5 text-caption text-ink-subtle sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to move
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" aria-hidden />
                </Kbd>
                to open
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5">
                <Kbd>?</Kbd> all shortcuts
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
