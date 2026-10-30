"use client";

import { Pencil } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { duration, easeOutSoft } from "@/lib/motion";

const EditingCtx = React.createContext<() => void>(() => {});

/** Forms inside an EditableSection call this to return to the read view. */
export function useEditableDone() {
  return React.useContext(EditingCtx);
}

/**
 * A card that switches between reading and editing in place. `form` is an
 * element (Server Components can't pass functions), and it reaches the
 * section's `done` callback through useEditableDone().
 */
export function EditableSection({
  title,
  description,
  canEdit,
  editLabel = "Edit",
  view,
  form,
}: {
  title: string;
  description?: string;
  canEdit: boolean;
  editLabel?: string;
  view: React.ReactNode;
  form: React.ReactNode;
}) {
  const [editing, setEditing] = React.useState(false);
  const headingId = React.useId();
  const editRef = React.useRef<HTMLButtonElement>(null);

  function done() {
    setEditing(false);
    // Hand focus back to where editing started.
    requestAnimationFrame(() => editRef.current?.focus());
  }

  return (
    <Card aria-labelledby={headingId} role="region">
      <CardHeader
        title={<span id={headingId}>{title}</span>}
        description={description}
        action={
          canEdit &&
          !editing && (
            <Button
              ref={editRef}
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              aria-label={`${editLabel}: ${title}`}
            >
              <Pencil aria-hidden /> {editLabel}
            </Button>
          )
        }
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={editing ? "form" : "view"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: duration.base, ease: easeOutSoft }}
          className="px-5 pt-4 pb-5"
        >
          {editing ? <EditingCtx.Provider value={done}>{form}</EditingCtx.Provider> : view}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

export function FormActions({ onCancel, saving }: { onCancel: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-2">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" loading={saving}>
        Save changes
      </Button>
    </div>
  );
}
