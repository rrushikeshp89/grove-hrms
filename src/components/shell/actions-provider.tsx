"use client";

import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { createSequenceMatcher, isTypingTarget, parseShortcut } from "@/lib/shortcuts";

/**
 * One registry powers the command palette, keyboard shortcuts and the "?"
 * cheat sheet. Features register actions where they live; nothing has to be
 * listed twice.
 */
export type ActionGroup = "Navigate" | "Actions" | "Preferences" | "Help";

export type Action = {
  id: string;
  label: string;
  group: ActionGroup;
  icon?: LucideIcon;
  hint?: string;
  shortcut?: string;
  keywords?: string[];
  /** Hide from the palette (e.g. the palette's own shortcut). */
  paletteHidden?: boolean;
  /** Fire even while typing in a field (only for modifier chords). */
  global?: boolean;
  perform: () => void;
};

type Ctx = {
  actions: Action[];
  register: (actions: Action[]) => () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
};

const ActionsCtx = React.createContext<Ctx | null>(null);

function subscribePlatform() {
  return () => {};
}

/** macOS shows ⌘; everything else shows Ctrl. Server renders "Ctrl". */
export function useIsMac() {
  return React.useSyncExternalStore(
    subscribePlatform,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

export function ActionsProvider({ children }: { children: React.ReactNode }) {
  const [sets, setSets] = React.useState<Map<number, Action[]>>(() => new Map());
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const nextKey = React.useRef(0);
  const isMac = useIsMac();

  const register = React.useCallback((actions: Action[]) => {
    const key = nextKey.current++;
    setSets((prev) => new Map(prev).set(key, actions));
    return () =>
      setSets((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
  }, []);

  const actions = React.useMemo(() => {
    // Later registrations override earlier ones with the same id.
    const byId = new Map<string, Action>();
    for (const list of sets.values()) for (const a of list) byId.set(a.id, a);
    return [...byId.values()];
  }, [sets]);

  const actionsRef = React.useRef(actions);
  React.useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  React.useEffect(() => {
    const bound = actions.filter((a) => a.shortcut);
    const feed = createSequenceMatcher(
      bound.map((a) => ({ id: a.id, steps: parseShortcut(a.shortcut!) })),
      isMac,
    );
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = isTypingTarget(e.target);
      const id = feed(e, performance.now());
      if (!id) return;
      const action = actionsRef.current.find((a) => a.id === id);
      if (!action || (typing && !action.global)) return;
      e.preventDefault();
      action.perform();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, isMac]);

  const value = React.useMemo(
    () => ({ actions, register, paletteOpen, setPaletteOpen, helpOpen, setHelpOpen }),
    [actions, register, paletteOpen, helpOpen],
  );

  return <ActionsCtx.Provider value={value}>{children}</ActionsCtx.Provider>;
}

export function useActions() {
  const ctx = React.useContext(ActionsCtx);
  if (!ctx) throw new Error("useActions must be used inside <ActionsProvider>");
  return ctx;
}

/**
 * Register actions for as long as the calling component is mounted. Pass a
 * memoized array; `perform` closures should read fresh values through refs
 * or stable callbacks.
 */
export function useRegisterActions(actions: Action[]) {
  const { register } = useActions();
  React.useEffect(() => register(actions), [register, actions]);
}
