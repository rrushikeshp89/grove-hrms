"use client";

import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { JobOptions } from "../queries";
import { displayName } from "../format";

/** Designations grouped under their department, filtered to the chosen one. */
export function DesignationSelect({
  value,
  onChange,
  options,
  departmentId,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  options: JobOptions;
  departmentId: string;
  onBlur?: () => void;
}) {
  const list = options.designations.filter(
    (d) => !d.departmentId || d.departmentId === departmentId,
  );
  const dept = options.departments.find((d) => d.id === departmentId);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger onBlur={onBlur}>
        <SelectValue
          placeholder={dept ? `Choose a ${dept.name} title` : "Choose a department first"}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {dept && <SelectLabel>{dept.name}</SelectLabel>}
          {list.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.title}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function ManagerCombobox({
  value,
  onChange,
  options,
  exclude,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: JobOptions;
  exclude?: string;
}) {
  const items = React.useMemo(
    () =>
      options.managers
        .filter((m) => m.id !== exclude)
        .map((m) => ({
          value: m.id,
          label: displayName(m),
          hint: m.designation.title,
          keywords: [m.designation.title],
          leading: <Avatar name={displayName(m)} src={m.avatarUrl} size="xs" />,
        })),
    [options.managers, exclude],
  );
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={items}
      placeholder="Search people"
      searchPlaceholder="Search by name or role"
      emptyText="No one by that name."
    />
  );
}
