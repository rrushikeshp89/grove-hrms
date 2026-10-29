"use client";

import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import * as React from "react";

import { commandScore } from "@/lib/command-filter";
import { cn } from "@/lib/utils";

import { useFieldProps } from "./field";
import { controlBase } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./overlay";
import { menuItem } from "./select";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary line, e.g. a designation under a person's name. */
  hint?: string;
  leading?: React.ReactNode;
  keywords?: string[];
};

/** Searchable single select: managers, departments, locations. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  className,
  id,
  ...aria
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  const field = useFieldProps({ id, ...aria });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        {...field}
        className={cn(
          controlBase,
          "flex h-9 items-center gap-2 px-3 text-left text-body",
          !selected && "text-ink-subtle",
          className,
        )}
      >
        {selected?.leading}
        <span className="flex-1 truncate">{selected?.label ?? placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command loop filter={commandScore}>
          <div className="flex items-center gap-2 border-b border-hairline px-3">
            <Search className="size-4 text-ink-subtle" aria-hidden />
            <Command.Input
              placeholder={searchPlaceholder}
              className="h-10 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
            />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-small text-ink-muted">
              {emptyText}
            </Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={`${o.label} ${o.value}`}
                keywords={[o.hint ?? "", ...(o.keywords ?? [])]}
                onSelect={() => {
                  onChange(o.value === value ? null : o.value);
                  setOpen(false);
                }}
                className={cn(menuItem, "data-[selected=true]:bg-surface-hover")}
              >
                {o.leading}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ink">{o.label}</span>
                  {o.hint && (
                    <span className="truncate text-caption text-ink-subtle">{o.hint}</span>
                  )}
                </span>
                {o.value === value && <Check className="text-accent!" aria-hidden />}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
