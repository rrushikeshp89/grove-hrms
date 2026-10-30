"use client";

import { Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";

import { changeRole } from "../actions";
import type { RolePerson } from "../queries";

/**
 * Everyone with a sign-in and their role. Super admins can change a role
 * here; the server enforces the safeguards (not your own, never the last
 * super admin, not the demo accounts), and the UI just explains them.
 */
export function RoleTable({
  people,
  canAssign,
  me,
}: {
  people: RolePerson[];
  canAssign: boolean;
  me: string;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [roles, setRoles] = React.useState<Record<string, Role>>(() =>
    Object.fromEntries(people.map((p) => [p.id, p.role])),
  );
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? people.filter((p) => `${p.name} ${p.email} ${p.title ?? ""}`.toLowerCase().includes(needle))
    : people;

  async function change(p: RolePerson, role: Role) {
    const before = roles[p.id]!;
    setRoles((r) => ({ ...r, [p.id]: role }));
    const res = await changeRole({ userId: p.id, role });
    if (!res.ok) {
      setRoles((r) => ({ ...r, [p.id]: before }));
      toast.error("Role not changed", { description: res.error });
      return;
    }
    toast.success(`${p.name} is now ${ROLE_LABELS[role]}`);
    router.refresh();
  }

  const locked = (p: RolePerson) => (p.id === me ? "That's you" : p.isDemo ? "Demo account" : null);

  return (
    <div>
      <div className="border-b border-hairline p-3">
        <Input
          type="search"
          aria-label="Search people"
          placeholder="Search by name, email or title"
          leadingIcon={<Search aria-hidden />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div
        className="max-h-[32rem] overflow-auto"
        tabIndex={0}
        role="region"
        aria-label="People and their roles"
      >
        <table className="w-full min-w-[34rem] text-left text-body">
          <caption className="sr-only">People and their roles</caption>
          <thead className="sticky top-0 bg-surface-sunken text-caption text-ink-muted">
            <tr>
              <th scope="col" className="h-10 px-5 font-medium">
                Person
              </th>
              <th scope="col" className="px-3 font-medium">
                Role
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const why = locked(p);
              return (
                <tr key={p.id} className="border-t border-hairline">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-small text-ink-muted">
                          {p.title ?? p.email}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-2">
                    {canAssign ? (
                      <span className="flex items-center gap-2">
                        <span className="w-44">
                          <Select
                            value={roles[p.id]}
                            onValueChange={(v) => change(p, v as Role)}
                            disabled={!!why}
                          >
                            <SelectTrigger aria-label={`Role for ${p.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </span>
                        {why && (
                          <Badge>
                            <Lock aria-hidden /> {why}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <Badge tone="accent">{ROLE_LABELS[roles[p.id]!]}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-ink-muted">
                  No one matches &ldquo;{q}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
