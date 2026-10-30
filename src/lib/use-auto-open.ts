"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/**
 * Opens a sheet when the page is reached with `?new=<kind>`, which is how the
 * "n then …" shortcuts and the palette start a task on another page. The
 * parameter is removed afterwards so a refresh doesn't open it again.
 */
export function useAutoOpen(kind: string, open: () => void) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const wanted = params.get("new") === kind;
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  });

  React.useEffect(() => {
    if (!wanted) return;
    openRef.current();
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // `params` is read once, when the parameter first shows up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);
}
