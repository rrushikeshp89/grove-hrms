"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";

import { convertToEmployee } from "../actions";
import { suggestWorkEmail } from "../logic/pipeline";
import type { RecruitmentOptions } from "../queries";
import { convertSchema, type ConvertInput } from "../schemas";

/**
 * The last step of hiring. Title, department, location and contract come
 * from the role, so only what the role can't know is asked for here.
 */
export function ConvertDialog({
  candidate,
  hiringManagerId,
  suggestedStart,
  options,
  onOpenChange,
}: {
  candidate: { id: string; firstName: string; lastName: string } | null;
  hiringManagerId: string;
  suggestedStart: string;
  options: Pick<RecruitmentOptions, "managers" | "takenEmails">;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<ConvertInput, unknown, z.output<typeof convertSchema>>({
    resolver: zodResolver(convertSchema),
    values: {
      candidateId: candidate?.id ?? "",
      workEmail: candidate
        ? suggestWorkEmail(candidate.firstName, candidate.lastName, new Set(options.takenEmails))
        : "",
      managerId: hiringManagerId,
      joinDate: suggestedStart,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await convertToEmployee(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof ConvertInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Couldn't complete the hire", { description: r.error });
      return;
    }
    toast.success(`${candidate?.firstName} is joining`, {
      description: r.data.roleClosed
        ? "Onboarding has started. Every opening is filled, so the role is closed."
        : "Their employee record is ready and onboarding has started.",
    });
    onOpenChange(false);
    router.push(
      r.data.checklistId ? `/lifecycle/${r.data.checklistId}` : `/people/${r.data.employeeId}`,
    );
  });

  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={`Hire ${candidate?.firstName ?? ""}`}
          description="Creates their employee record and starts onboarding. Title, department and location come from the role."
        />
        <form onSubmit={submit} noValidate>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Work email" error={errors.workEmail?.message} className="sm:col-span-2">
              <Input type="email" {...form.register("workEmail")} />
            </Field>
            <Field label="First day" error={errors.joinDate?.message}>
              <Input type="date" {...form.register("joinDate")} />
            </Field>
            <Field label="Reports to" error={errors.managerId?.message}>
              <Controller
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <Combobox
                    value={field.value}
                    onChange={field.onChange}
                    searchPlaceholder="Search people"
                    options={options.managers.map((m) => ({
                      value: m.id,
                      label: m.name,
                      hint: m.title,
                    }))}
                  />
                )}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <UserCheck aria-hidden /> Complete hire
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
