"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

import { createEmployee } from "../actions";
import { EMPLOYMENT_LABELS } from "../format";
import type { JobOptions } from "../queries";
import { newEmployeeSchema, type NewEmployeeInput } from "../schemas";
import { DesignationSelect, ManagerCombobox } from "./person-fields";
import { useAutoOpen } from "@/lib/use-auto-open";

const today = () => new Date().toISOString().slice(0, 10);

export function AddEmployeeSheet({ options }: { options: JobOptions }) {
  const [open, setOpen] = React.useState(false);
  useAutoOpen("employee", () => setOpen(true));
  const router = useRouter();
  const office =
    options.locations.find((l) => l.name.includes("Bengaluru")) ?? options.locations[0];
  const form = useForm<NewEmployeeInput>({
    resolver: zodResolver(newEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workEmail: "",
      departmentId: "",
      designationId: "",
      locationId: office?.id ?? "",
      managerId: "",
      employmentType: "FULL_TIME",
      joinDate: today(),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const departmentId = useWatch({ control: form.control, name: "departmentId" });

  // Suggest the work email from the name until someone types their own.
  const emailTouched = form.formState.dirtyFields.workEmail;
  const [first, last] = useWatch({ control: form.control, name: ["firstName", "lastName"] });
  React.useEffect(() => {
    if (emailTouched || !first || !last) return;
    const slug = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[^a-zA-Z]/g, "")
        .toLowerCase();
    form.setValue("workEmail", `${slug(first)}.${slug(last)}@northwindgrove.in`);
  }, [first, last, emailTouched, form]);

  async function onSubmit(values: NewEmployeeInput) {
    const result = await createEmployee(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof NewEmployeeInput, { message: messages[0] });
      }
      if (!result.fieldErrors) toast.error("Couldn't add them", { description: result.error });
      return;
    }
    toast.success(`${values.firstName} ${values.lastName} added`, {
      description: `Employee ID ${result.data.employeeCode}.`,
    });
    setOpen(false);
    form.reset();
    router.push(`/people/${result.data.id}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <UserPlus aria-hidden /> Add employee
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-lg">
        <SheetHeader
          title="Add an employee"
          description="They'll appear in the directory and org chart straight away."
        />
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message}>
              <Input autoComplete="off" {...form.register("firstName")} />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Input autoComplete="off" {...form.register("lastName")} />
            </Field>
            <Field label="Work email" error={errors.workEmail?.message} className="sm:col-span-2">
              <Input type="email" {...form.register("workEmail")} />
            </Field>
            <Field label="Department" error={errors.departmentId?.message}>
              <Controller
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("designationId", "");
                    }}
                  >
                    <SelectTrigger onBlur={field.onBlur}>
                      <SelectValue placeholder="Choose a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Designation" error={errors.designationId?.message}>
              <Controller
                control={form.control}
                name="designationId"
                render={({ field }) => (
                  <DesignationSelect
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={options}
                    departmentId={departmentId}
                  />
                )}
              />
            </Field>
            <Field label="Reports to" error={errors.managerId?.message} className="sm:col-span-2">
              <Controller
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <ManagerCombobox
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    options={options}
                  />
                )}
              />
            </Field>
            <Field label="Location" error={errors.locationId?.message}>
              <Controller
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Employment type" error={errors.employmentType?.message}>
              <Controller
                control={form.control}
                name="employmentType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_LABELS).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Joining date"
              hint="A future date starts them as Onboarding."
              error={errors.joinDate?.message}
              className="sm:col-span-2"
            >
              <Input type="date" {...form.register("joinDate")} className="sm:max-w-48" />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <UserPlus aria-hidden /> Add employee
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
