"use client";

import { ArrowRight, Keyboard, Menu, Moon, PanelLeft, Rows3, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/overlay";
import { Kbd } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/tooltip";
import {
  APP_NAVIGATION,
  DESIGN_NAVIGATION,
  navigationFor,
  type NavGroup,
} from "@/config/navigation";
import { quickActionsFor } from "@/config/quick-actions";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useTheme } from "@/hooks/use-theme";
import { getDensity, isSidebarCollapsed, setDensity, setSidebarCollapsed } from "@/lib/preferences";
import type { Role } from "@/lib/roles";

import { useActions, useIsMac, useRegisterActions, type Action } from "./actions-provider";
import { BrandMark, Wordmark } from "./brand";
import { CommandPalette } from "./command-palette";
import { ThemeMenu } from "./preference-controls";
import { PreferenceSync } from "./preference-sync";
import { ShortcutSheet } from "./shortcut-sheet";
import { NavList, Sidebar } from "./sidebar";
import { UserMenu, type ShellUser } from "./user-menu";

export type { ShellUser };

function useShellActions(groups: NavGroup[], role: Role | null) {
  const router = useRouter();
  const { setPaletteOpen, setHelpOpen } = useActions();
  const { resolvedTheme, setTheme } = useTheme();
  const themeRef = React.useRef(resolvedTheme);
  React.useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  const actions = React.useMemo<Action[]>(
    () => [
      {
        id: "palette.open",
        label: "Open command palette",
        group: "Help",
        shortcut: "mod+k",
        global: true,
        paletteHidden: true,
        perform: () => setPaletteOpen(true),
      },
      {
        id: "palette.slash",
        label: "Search everything",
        group: "Help",
        icon: Search,
        shortcut: "/",
        keywords: ["find", "lookup"],
        paletteHidden: true,
        perform: () => setPaletteOpen(true),
      },
      {
        id: "help.shortcuts",
        label: "Show keyboard shortcuts",
        group: "Help",
        icon: Keyboard,
        shortcut: "?",
        keywords: ["keys", "hotkeys", "help"],
        perform: () => setHelpOpen(true),
      },
      ...quickActionsFor(role).map<Action>((q) => ({
        id: q.id,
        label: q.label,
        group: "Actions",
        icon: q.icon,
        shortcut: q.shortcut,
        keywords: q.keywords,
        perform: () => router.push(q.href),
      })),
      ...groups.flatMap((g) =>
        g.items.map<Action>((item) => ({
          id: `nav.${item.href}`,
          label: item.label,
          hint: g.label,
          group: "Navigate",
          icon: item.icon,
          shortcut: item.shortcut,
          keywords: item.keywords,
          perform: () => router.push(item.href),
        })),
      ),
      {
        id: "pref.theme",
        label: "Toggle dark mode",
        group: "Preferences",
        icon: Moon,
        shortcut: "shift+d",
        keywords: ["theme", "light", "dark", "appearance"],
        perform: () => setTheme(themeRef.current === "dark" ? "light" : "dark"),
      },
      {
        id: "pref.density",
        label: "Toggle compact density",
        group: "Preferences",
        icon: Rows3,
        shortcut: "shift+c",
        keywords: ["compact", "comfortable", "rows", "table"],
        perform: () => setDensity(getDensity() === "compact" ? "comfortable" : "compact"),
      },
      {
        id: "pref.sidebar",
        label: "Toggle sidebar",
        group: "Preferences",
        icon: PanelLeft,
        shortcut: "[",
        keywords: ["collapse", "expand", "navigation"],
        perform: () => setSidebarCollapsed(!isSidebarCollapsed()),
      },
    ],
    [groups, role, router, setHelpOpen, setPaletteOpen, setTheme],
  );
  useRegisterActions(actions);
}

function SearchTrigger() {
  const { setPaletteOpen } = useActions();
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-control border border-hairline bg-surface px-3 text-body text-ink-subtle shadow-xs transition-colors hover:border-border-strong hover:text-ink-muted"
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 truncate text-left">Search or jump to…</span>
      <span className="hidden items-center gap-0.5 sm:inline-flex" aria-hidden>
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
      <span className="sr-only">Open command palette</span>
    </button>
  );
}

/**
 * Navigation is resolved here, on the client, because nav items carry icon
 * components that can't be serialized from a Server Component. The server
 * passes plain user data (or nothing, on the public design pages).
 */
export function AppShell({
  variant,
  user = null,
  children,
}: {
  variant: "app" | "design";
  user?: ShellUser | null;
  children: React.ReactNode;
}) {
  const role = user?.role ?? null;
  const groups = React.useMemo(
    () => navigationFor(role, variant === "app" ? APP_NAVIGATION : DESIGN_NAVIGATION),
    [role, variant],
  );
  const homeHref = variant === "app" ? "/home" : "/design";
  useShellActions(groups, role);
  const { setHelpOpen, setPaletteOpen } = useActions();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="fixed top-3 left-3 z-[60] -translate-y-16 rounded-control bg-accent px-3 py-2 text-small font-medium text-accent-fg transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <Sidebar
        groups={groups}
        homeHref={homeHref}
        onToggle={() => setSidebarCollapsed(!isSidebarCollapsed())}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-bg/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="-ml-1.5 grid size-9 place-items-center rounded-control text-ink-muted hover:bg-surface-hover hover:text-ink lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <span className="flex items-center gap-2 lg:hidden">
            <BrandMark className="size-7" />
            <Wordmark className="text-[1.2rem]" />
          </span>

          <div className="hidden flex-1 sm:flex">
            <SearchTrigger />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-surface-hover hover:text-ink sm:hidden"
            >
              <Search className="size-[18px]" aria-hidden />
            </button>
            <Tooltip content="Keyboard shortcuts" shortcut="?">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="Keyboard shortcuts"
                className="hidden size-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink sm:grid"
              >
                <Keyboard className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </button>
            </Tooltip>
            {user && <NotificationBell />}
            <ThemeMenu />
            {user ? (
              <span className="ml-1.5">
                <UserMenu user={user} />
              </span>
            ) : (
              variant === "design" && (
                <Button asChild size="sm" variant="secondary" className="ml-2">
                  <Link href="/home">
                    Open Grove <ArrowRight aria-hidden />
                  </Link>
                </Button>
              )
            )}
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="px-3 py-4">
          <div className="mb-6 flex items-center gap-2.5 px-1.5">
            <BrandMark />
            <Wordmark />
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </div>
          <NavList groups={groups} collapsible={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette peopleSearch={variant === "app"} />
      <ShortcutSheet />
      {user && <PreferenceSync user={user} />}
    </div>
  );
}
