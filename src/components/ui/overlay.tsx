"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive, Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

import { overlayPanel } from "./select";

/* ─── Dialog ───────────────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Scrim() {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-scrim",
        "data-[state=closed]:animate-[fade-out_150ms_var(--ease-in-soft)] data-[state=open]:animate-[fade-in_200ms_var(--ease-out-soft)]",
      )}
    />
  );
}

function CloseButton() {
  return (
    <DialogPrimitive.Close
      className="absolute top-4 right-4 grid size-8 place-items-center rounded-control text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
      aria-label="Close"
    >
      <X className="size-4" aria-hidden />
    </DialogPrimitive.Close>
  );
}

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { size?: "sm" | "md" | "lg" }) {
  return (
    <DialogPrimitive.Portal>
      <Scrim />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
          "rounded-overlay border border-hairline bg-surface shadow-lg outline-none",
          "data-[state=closed]:animate-[dialog-out_150ms_var(--ease-in-soft)] data-[state=open]:animate-[dialog-in_220ms_var(--ease-out-soft)]",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 pt-6 pr-14", className)}>
      <DialogPrimitive.Title className="font-display-soft text-title font-medium text-ink">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-1 text-body text-ink-muted">
          {description}
        </DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken/50 px-6 py-4 sm:flex-row sm:justify-end",
        "rounded-b-overlay",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Sheet ────────────────────────────────────────────────────────────── */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;

/**
 * Slides from the right on desktop. `side="bottom"` is used on phones for
 * forms like apply-leave so they sit under the thumb.
 */
export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" | "bottom" }) {
  return (
    <DialogPrimitive.Portal>
      <Scrim />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col border-hairline bg-surface shadow-lg outline-none",
          side === "right" &&
            "inset-y-0 right-0 w-full max-w-md border-l data-[state=closed]:animate-[sheet-out-right_180ms_var(--ease-in-soft)] data-[state=open]:animate-[sheet-in-right_260ms_var(--ease-out-soft)]",
          side === "left" &&
            "inset-y-0 left-0 w-[min(20rem,85vw)] border-r data-[state=closed]:animate-[sheet-out-left_180ms_var(--ease-in-soft)] data-[state=open]:animate-[sheet-in-left_260ms_var(--ease-out-soft)]",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-overlay border-t data-[state=closed]:animate-[sheet-out-bottom_180ms_var(--ease-in-soft)] data-[state=open]:animate-[sheet-in-bottom_260ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border-strong"
          />
        )}
        {children}
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const SheetHeader = DialogHeader;
export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex gap-2 border-t border-hairline px-6 py-4 sm:justify-end", className)}
      {...props}
    />
  );
}

/* ─── Popover ──────────────────────────────────────────────────────────── */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          overlayPanel,
          "origin-(--radix-popover-content-transform-origin) p-3 data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
