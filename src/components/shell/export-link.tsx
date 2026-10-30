import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A plain link to a download route. The browser handles the file, so there is
 * no client JavaScript and it works before hydration.
 */
export function ExportLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      download
      className={cn(buttonVariants({ variant: "secondary", size: "md" }), className)}
    >
      <Download strokeWidth={1.75} aria-hidden />
      {children}
    </a>
  );
}
