"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

import { useFieldProps } from "./field";
import { controlBase } from "./input";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const field = useFieldProps(props);
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        controlBase,
        "flex h-9 items-center justify-between gap-2 px-3 text-left text-body",
        "data-placeholder:text-ink-subtle [&>span]:truncate",
        className,
      )}
      {...props}
      {...field}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export const overlayPanel =
  "z-50 rounded-overlay border border-hairline bg-surface text-ink shadow-md outline-none";

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        className={cn(
          overlayPanel,
          "relative max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden p-1",
          "origin-(--radix-select-content-transform-origin) data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export const menuItem = [
  "relative flex cursor-default items-center gap-2 rounded-sm px-2.5 py-1.5 text-body outline-none select-none",
  "data-highlighted:bg-surface-hover data-disabled:pointer-events-none data-disabled:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle",
].join(" ");

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(menuItem, "pr-8", className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 inline-flex">
        <Check className="text-accent!" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("px-2.5 pt-2 pb-1 eyebrow", className)} {...props} />;
}
