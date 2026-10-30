import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Every payroll screen says so: nothing here moves real money. */
export function SimulatedBadge() {
  return (
    <Badge tone="highlight" size="md">
      <FlaskConical aria-hidden /> Simulated payroll
    </Badge>
  );
}

export function SimulatedNote() {
  return (
    <p className="rounded-control border border-hairline bg-highlight-subtle/60 px-4 py-3 text-small text-highlight-ink">
      Payroll in Grove is a simulation. Amounts come from demo salary structures and attendance, and
      nothing here is a real payment, payslip or tax calculation.
    </p>
  );
}
