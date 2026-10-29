"use client";

import * as React from "react";

const subscribeNothing = () => () => {};

/**
 * True after hydration. Use it for UI that depends on the viewer's clock,
 * locale or storage, so prerendered HTML stays deterministic.
 */
export function useMounted() {
  return React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}
