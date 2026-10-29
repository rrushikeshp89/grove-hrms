"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 text-success" aria-hidden />,
        error: <CircleAlert className="size-4 text-danger" aria-hidden />,
        warning: <TriangleAlert className="size-4 text-warning" aria-hidden />,
        info: <Info className="size-4 text-info" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[var(--width)] items-start gap-3 rounded-card border border-hairline bg-surface p-4 text-ink shadow-lg",
          icon: "mt-0.5",
          title: "text-body font-medium",
          description: "mt-0.5 text-small text-ink-muted",
          content: "flex-1",
          actionButton:
            "ml-2 h-7 shrink-0 rounded-sm bg-accent px-2.5 text-small font-medium text-accent-fg",
          cancelButton:
            "ml-2 h-7 shrink-0 rounded-sm bg-surface-sunken px-2.5 text-small font-medium text-ink",
        },
      }}
    />
  );
}
