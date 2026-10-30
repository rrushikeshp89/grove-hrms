"use client";

import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { useFieldProps } from "./field";

/**
 * Free-text tags (skills, languages). Enter or comma adds, Backspace in an
 * empty field removes the last tag, each tag has its own remove button.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
  max = 12,
  ...aria
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const field = useFieldProps(aria);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (!tag || value.length >= max) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-control border border-border-input bg-surface px-2 py-1.5",
        "transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20",
        field["aria-invalid"] && "border-danger",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-6 items-center gap-1 rounded-full border border-hairline bg-surface-sunken pr-1 pl-2.5 text-small text-ink"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="grid size-4 place-items-center rounded-full text-ink-subtle hover:bg-surface-active hover:text-ink"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        {...field}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length >= max ? `Up to ${max}` : value.length ? "" : placeholder}
        disabled={value.length >= max}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-body text-ink outline-none placeholder:text-ink-subtle"
      />
    </div>
  );
}
