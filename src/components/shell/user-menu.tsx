"use client";

import { ArrowLeftRight, LogOut, Palette, Settings } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { signInAsDemo, signOut } from "@/features/auth/actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";

export type ShellUser = {
  name: string;
  email: string;
  role: Role;
  isDemo: boolean;
  designation: string | null;
  avatarUrl: string | null;
  themePref: "SYSTEM" | "LIGHT" | "DARK";
  densityPref: "COMFORTABLE" | "COMPACT";
};

export function UserMenu({ user }: { user: ShellUser }) {
  const [pending, startTransition] = React.useTransition();

  function switchTo(role: Role) {
    startTransition(async () => {
      const result = await signInAsDemo({ role });
      // Success redirects; only failures come back.
      if (result && !result.ok) toast.error("Couldn't switch roles", { description: result.error });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        disabled={pending}
        className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover sm:rounded-control sm:py-1 sm:pr-2.5 sm:pl-1"
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        <span className="hidden max-w-36 truncate text-small font-medium text-ink md:inline">
          {user.name.split(" ")[0]}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={user.name} src={user.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-ink">{user.name}</p>
            <p className="truncate text-caption text-ink-subtle">{user.email}</p>
            <Badge tone="accent" className="mt-1">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/design">
            <Palette aria-hidden /> Design system
          </Link>
        </DropdownMenuItem>
        {user.isDemo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Explore as another role</DropdownMenuLabel>
            {ROLES.filter((r) => r !== user.role).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => switchTo(r)}>
                <ArrowLeftRight aria-hidden /> {ROLE_LABELS[r]}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
