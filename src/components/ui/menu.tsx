"use client";

import { Check } from "lucide-react";
import { DropdownMenu as MenuPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

import { menuItem, overlayPanel } from "./select";

/* ─── Dropdown menu ────────────────────────────────────────────────────── */

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          overlayPanel,
          "min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) p-1",
          "data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  tone,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & {
  tone?: "danger";
  shortcut?: React.ReactNode;
}) {
  return (
    <MenuPrimitive.Item
      className={cn(
        menuItem,
        tone === "danger" && "text-danger data-highlighted:bg-danger-subtle [&_svg]:text-danger",
        className,
      )}
      {...props}
    >
      {/* asChild (e.g. wrapping a Link) needs exactly one child to slot onto */}
      {props.asChild ? (
        children
      ) : (
        <>
          {children}
          {shortcut && (
            <span className="ml-auto pl-4 text-caption text-ink-subtle">{shortcut}</span>
          )}
        </>
      )}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(menuItem, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2.5 inline-flex">
        <Check className="text-accent!" aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2.5 pt-2 pb-1 eyebrow", className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-hairline", className)} />;
}

/* ─── Tabs ─────────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

/** Underline tabs for page-level sections (profile tabs, settings). */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex [scrollbar-width:none] items-center gap-6 overflow-x-auto border-b border-hairline",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent text-body font-medium whitespace-nowrap",
        "text-ink-muted transition-colors duration-150 hover:text-ink",
        "data-[state=active]:border-accent data-[state=active]:text-ink",
        "[&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-6 outline-none data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  );
}
