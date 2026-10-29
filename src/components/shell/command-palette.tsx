"use client";

import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { Kbd } from "@/components/ui/primitives";
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

export function CommandPalette() {
  const { actions, paletteOpen, setPaletteOpen } = useActions();
  const [search, setSearch] = React.useState("");

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
                placeholder="Search pages and actions…"
                className="h-14 flex-1 bg-transparent text-heading text-ink outline-none placeholder:text-ink-subtle"
              />
              <Kbd className="hidden sm:inline-flex">Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,26rem)] scroll-py-2 overflow-y-auto p-2">
              <Command.Empty className="px-4 py-10 text-center">
                <p className="text-body text-ink">Nothing matches &ldquo;{search}&rdquo;</p>
                <p className="mt-1 text-small text-ink-muted">
                  Try a page name like &ldquo;components&rdquo; or an action like
                  &ldquo;dark&rdquo;.
                </p>
              </Command.Empty>
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
