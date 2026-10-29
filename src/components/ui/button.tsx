import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap select-none",
    "rounded-control transition-[background-color,color,box-shadow,transform] duration-150 ease-out-soft",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg shadow-press hover:bg-accent-hover",
        secondary:
          "border border-border-strong bg-surface text-ink shadow-xs hover:border-border-input hover:bg-surface-hover",
        ghost: "text-ink-muted hover:bg-surface-hover hover:text-ink",
        quiet: "bg-surface-sunken text-ink hover:bg-surface-active",
        destructive: "bg-danger text-danger-fg shadow-press hover:bg-danger-hover",
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline active:translate-y-0",
      },
      size: {
        sm: "h-8 px-3 text-small [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-body [&_svg]:size-4",
        lg: "h-11 px-5 text-body [&_svg]:size-[18px]",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="absolute inset-0 grid place-items-center">
              <LoaderCircle className="animate-spin" aria-hidden />
            </span>
          )}
          <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>
            {children}
          </span>
        </>
      )}
    </Comp>
  );
}
