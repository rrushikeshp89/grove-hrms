"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

import { createRun } from "../actions";

export function NewRun({ options }: { options: { year: number; month: number; label: string }[] }) {
  const router = useRouter();
  const [value, setValue] = React.useState(
    options[0] ? `${options[0].year}-${options[0].month}` : "",
  );
  const [pending, startTransition] = React.useTransition();
  if (options.length === 0) return null;

  function start() {
    const [year, month] = value.split("-").map(Number) as [number, number];
    startTransition(async () => {
      const r = await createRun({ year, month });
      if (!r.ok) {
        toast.error("Couldn't start the run", { description: r.error });
        return;
      }
      toast.success("Draft created", { description: "Check it over, then send it for review." });
      router.push(`/payroll/${r.data.id}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-44">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger aria-label="Month to run">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={start} loading={pending}>
        <Plus aria-hidden /> Start run
      </Button>
    </div>
  );
}
