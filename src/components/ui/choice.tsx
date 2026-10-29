"use client";

import { Check, Minus } from "lucide-react";
import { motion } from "motion/react";
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioPrimitive,
  Slider as SliderPrimitive,
  Switch as SwitchPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
} from "radix-ui";
import * as React from "react";

import { snappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* ─── Checkbox ─────────────────────────────────────────────────────────── */

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-border-input bg-surface",
        "transition-colors duration-150 hover:border-ink-subtle",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-fg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* ─── Radio ────────────────────────────────────────────────────────────── */

export function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn("grid gap-2.5", className)} {...props} />;
}

export function RadioItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-full border border-border-input bg-surface",
        "transition-colors duration-150 hover:border-ink-subtle data-[state=checked]:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-2 rounded-full bg-accent" />
    </RadioPrimitive.Item>
  );
}

/* ─── Switch ───────────────────────────────────────────────────────────── */

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-transparent p-[2px]",
        "bg-border-strong transition-colors duration-200 data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-4 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out-soft",
          "data-[state=checked]:translate-x-4 dark:bg-ink dark:data-[state=checked]:bg-accent-fg",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

/* ─── Segmented control ────────────────────────────────────────────────── */

type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * A single-choice toggle (view switchers, density, ranges). The selected
 * pill slides between options with a shared-layout spring.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label": string;
}) {
  const layoutId = React.useId();
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control border border-hairline bg-surface-sunken p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <ToggleGroupPrimitive.Item
            key={opt.value}
            value={opt.value}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-[6px] font-medium transition-colors duration-150",
              size === "sm" ? "h-7 px-2.5 text-caption" : "h-8 px-3 text-small",
              active ? "text-ink" : "text-ink-muted hover:text-ink",
              "[&_svg]:size-3.5",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={snappy}
                className="absolute inset-0 rounded-[6px] border border-hairline bg-surface shadow-sm"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}

/* ─── Slider ───────────────────────────────────────────────────────────── */

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const count = (props.value ?? props.defaultValue ?? [0]).length;
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-5 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-active">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={props["aria-label"]}
          className="block size-[18px] rounded-full border-2 border-accent bg-surface shadow-sm transition-transform duration-150 hover:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
