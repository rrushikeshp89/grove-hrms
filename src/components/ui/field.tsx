"use client";

import { Label as LabelPrimitive, Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-small font-medium text-ink select-none", className)}
      {...props}
    />
  );
}

type FieldContext = { id: string; invalid: boolean; describedBy: string | undefined };
const FieldCtx = React.createContext<FieldContext | null>(null);

/**
 * Wires a label, hint and error message to one control with the right ARIA
 * attributes. React Hook Form passes `error` from its field state.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactElement;
}) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && !error && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  const ctx = { id, invalid: !!error, describedBy };

  return (
    <FieldCtx.Provider value={ctx}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={id} className="flex items-baseline justify-between gap-2">
          {label}
          {optional && <span className="text-caption font-normal text-ink-subtle">Optional</span>}
        </Label>
        <Slot.Root id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
          {children}
        </Slot.Root>
        {hint && !error && (
          <p id={hintId} className="text-small text-ink-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-small font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldCtx.Provider>
  );
}

/**
 * Controls that render through React Hook Form's <Controller> never receive
 * the props <Field> slots onto its child, so they read the wiring from
 * context instead. Explicit props still win.
 */
export function useFieldProps(props: {
  id?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
}) {
  const ctx = React.useContext(FieldCtx);
  return {
    id: props.id ?? ctx?.id,
    "aria-invalid": props["aria-invalid"] ?? (ctx?.invalid || undefined),
    "aria-describedby": props["aria-describedby"] ?? ctx?.describedBy,
  };
}
