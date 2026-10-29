"use client";

import * as React from "react";

import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/overlay";

import { useActions, type ActionGroup } from "./actions-provider";
import { Keycaps } from "./command-palette";

const ORDER: ActionGroup[] = ["Help", "Navigate", "Actions", "Preferences"];

export function ShortcutSheet() {
  const { actions, helpOpen, setHelpOpen } = useActions();

  const groups = React.useMemo(
    () =>
      ORDER.map((g) => ({
        group: g,
        items: actions.filter((a) => a.group === g && a.shortcut),
      })).filter((g) => g.items.length > 0),
    [actions],
  );

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent size="lg">
        <DialogHeader
          title="Keyboard shortcuts"
          description="Single-key shortcuts pause while you're typing in a field."
        />
        <DialogBody className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {groups.map(({ group, items }) => (
            <section key={group} aria-labelledby={`sc-${group}`}>
              <h3 id={`sc-${group}`} className="mb-2 eyebrow">
                {group}
              </h3>
              <dl className="flex flex-col">
                {items.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-4 border-b border-hairline py-2 last:border-0"
                  >
                    <dt className="text-body text-ink">{a.label}</dt>
                    <dd>
                      <Keycaps spec={a.shortcut!} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
