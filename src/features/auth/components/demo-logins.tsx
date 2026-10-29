"use client";

import { ArrowRight, Briefcase, LoaderCircle, ShieldCheck, UserRound, Users } from "lucide-react";
import * as React from "react";

import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { signInAsDemo } from "../actions";
import type { DEMO_ROLES } from "../schemas";

type DemoRole = (typeof DEMO_ROLES)[number];

const PERSONAS: {
  role: DemoRole;
  title: string;
  person: string;
  sees: string;
  icon: typeof Users;
}[] = [
  {
    role: "EMPLOYEE",
    title: "Employee",
    person: "Arjun Mehta · Senior Frontend Engineer",
    sees: "Their own profile, team and holidays",
    icon: UserRound,
  },
  {
    role: "TEAM_MANAGER",
    title: "Team manager",
    person: "Priya Raman · Engineering Manager",
    sees: "A team of eight to look after",
    icon: Users,
  },
  {
    role: "HR_MANAGER",
    title: "HR manager",
    person: "Rahul Deshpande · Head of People",
    sees: "The whole company and its policies",
    icon: Briefcase,
  },
  {
    role: "SUPER_ADMIN",
    title: "Super admin",
    person: "Aditya Banerjee · COO",
    sees: "Everything, including access control",
    icon: ShieldCheck,
  },
];

export function DemoLogins() {
  const [pending, setPending] = React.useState<DemoRole | null>(null);
  const [, startTransition] = React.useTransition();

  function go(role: DemoRole) {
    setPending(role);
    startTransition(async () => {
      const result = await signInAsDemo({ role });
      if (result && !result.ok) {
        toast.error("Couldn't start the demo", { description: result.error });
        setPending(null);
      }
    });
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {PERSONAS.map(({ role, title, person, sees, icon: Icon }) => {
        const busy = pending === role;
        return (
          <li key={role}>
            <button
              type="button"
              onClick={() => go(role)}
              disabled={pending !== null}
              aria-label={`Explore as ${title}: ${person}`}
              className={cn(
                "group flex h-full w-full flex-col gap-2 rounded-card border border-hairline bg-surface p-3.5 text-left shadow-xs",
                "transition-[border-color,box-shadow,transform] duration-200 ease-out-soft",
                "hover:-translate-y-px hover:border-accent/40 hover:shadow-sm disabled:cursor-wait",
                busy && "border-accent/50",
                pending && !busy && "opacity-60",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-control bg-accent-subtle text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
                ) : (
                  <ArrowRight
                    className="size-4 -translate-x-1 text-ink-subtle opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden
                  />
                )}
              </span>
              <span className="text-body font-semibold text-ink">{title}</span>
              <span className="-mt-1.5 text-caption text-ink-muted">{person}</span>
              <span className="text-caption text-ink-subtle">{sees}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
