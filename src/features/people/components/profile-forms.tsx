"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Phone, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Controller,
  useForm,
  useWatch,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toaster";
import type { ActionResult } from "@/server/action-error";

import {
  deleteEmergencyContact,
  saveEmergencyContact,
  updateJob,
  updatePersonal,
  updatePrivate,
} from "../actions";
import { STATUSES } from "../filters";
import { EMPLOYMENT_LABELS, STATUS_META } from "../format";
import type { JobOptions } from "../queries";
import {
  emergencyContactSchema,
  jobSchema,
  personalSchema,
  privateSchema,
  type EmergencyContactInput,
  type JobInput,
  type PersonalInput,
  type PrivateInput,
} from "../schemas";
import { FormActions, useEditableDone } from "./editable-section";
import { DesignationSelect, ManagerCombobox } from "./person-fields";

/**
 * Shared submit handling. The resolver validates on the client, but what we
 * send is the raw input: the server runs the same schema (with its
 * transforms) as the single source of truth. Field errors land on fields;
 * anything else becomes a toast.
 */
function useSave<TInput extends FieldValues, TOutput>(
  form: UseFormReturn<TInput, unknown, TOutput>,
  action: (values: TInput) => Promise<ActionResult<unknown>>,
  done: () => void,
  successTitle: string,
) {
  const router = useRouter();
  return form.handleSubmit(async () => {
    const result = await action(form.getValues());
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as Path<TInput>, { message: messages[0] });
      }
      if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
        toast.error("Changes not saved", { description: result.error });
      }
      return;
    }
    const changed = (result.data as { changed?: boolean } | null)?.changed !== false;
    if (changed) toast.success(successTitle);
    done();
    router.refresh();
  });
}

export function PersonalForm({ defaults }: { defaults: PersonalInput }) {
  const done = useEditableDone();
  const form = useForm<PersonalInput, unknown, z.output<typeof personalSchema>>({
    resolver: zodResolver(personalSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = useSave(form, updatePersonal, done, "Profile updated");
  const bio = useWatch({ control: form.control, name: "bio" }) ?? "";
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Preferred name"
        optional
        hint="What colleagues call you"
        error={errors.preferredName?.message}
      >
        <Input {...form.register("preferredName")} />
      </Field>
      <Field label="Pronouns" optional error={errors.pronouns?.message}>
        <Input placeholder="she/her, he/him, they/them" {...form.register("pronouns")} />
      </Field>
      <Field
        label="About"
        optional
        hint={`${bio.length}/400. A line or two about your work and what people can ask you about.`}
        error={errors.bio?.message}
        className="sm:col-span-2"
      >
        <Textarea rows={3} {...form.register("bio")} />
      </Field>
      <Field
        label="Skills"
        optional
        hint="Press Enter after each one."
        error={errors.skills?.message}
        className="sm:col-span-2"
      >
        <Controller
          control={form.control}
          name="skills"
          render={({ field }) => <TagInput value={field.value} onChange={field.onChange} />}
        />
      </Field>
      <FormActions onCancel={done} saving={isSubmitting} />
    </form>
  );
}

export function PrivateForm({ defaults }: { defaults: PrivateInput }) {
  const done = useEditableDone();
  const form = useForm<PrivateInput, unknown, z.output<typeof privateSchema>>({
    resolver: zodResolver(privateSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = useSave(form, updatePrivate, done, "Private details updated");
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Mobile" optional error={errors.phone?.message}>
        <Input type="tel" autoComplete="tel" {...form.register("phone")} />
      </Field>
      <Field label="Personal email" optional error={errors.personalEmail?.message}>
        <Input type="email" autoComplete="email" {...form.register("personalEmail")} />
      </Field>
      <Field label="Date of birth" optional error={errors.dateOfBirth?.message}>
        <Controller
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <Input
              type="date"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              onBlur={field.onBlur}
            />
          )}
        />
      </Field>
      <Field label="Neighbourhood" optional error={errors.area?.message}>
        <Input autoComplete="address-level3" {...form.register("area")} />
      </Field>
      <Field label="City" optional error={errors.city?.message}>
        <Input autoComplete="address-level2" {...form.register("city")} />
      </Field>
      <Field label="State" optional error={errors.state?.message}>
        <Input autoComplete="address-level1" {...form.register("state")} />
      </Field>
      <FormActions onCancel={done} saving={isSubmitting} />
    </form>
  );
}

export function JobForm({ defaults, options }: { defaults: JobInput; options: JobOptions }) {
  const done = useEditableDone();
  const form = useForm<JobInput, unknown, z.output<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = useSave(form, updateJob, done, "Job details updated");
  const departmentId = useWatch({ control: form.control, name: "departmentId" });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Department" error={errors.departmentId?.message}>
        <Controller
          control={form.control}
          name="departmentId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                const keep = options.designations.find(
                  (d) => d.id === form.getValues("designationId"),
                );
                if (keep?.departmentId !== v) form.setValue("designationId", "");
              }}
            >
              <SelectTrigger onBlur={field.onBlur}>
                <SelectValue />
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
              value={field.value}
              onChange={field.onChange}
              options={options}
              exclude={defaults.employeeId}
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
      <Field label="Status" error={errors.status?.message}>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger onBlur={field.onBlur}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Joining date" error={errors.joinDate?.message}>
        <Input type="date" {...form.register("joinDate")} />
      </Field>
      <FormActions onCancel={done} saving={isSubmitting} />
    </form>
  );
}

export type ContactRow = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
};

function ContactForm({
  employeeId,
  contact,
  done,
}: {
  employeeId: string;
  contact?: ContactRow;
  done: () => void;
}) {
  const form = useForm<EmergencyContactInput, unknown, z.output<typeof emergencyContactSchema>>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: contact
      ? { employeeId, ...contact }
      : { employeeId, name: "", relationship: "", phone: "", isPrimary: false },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = useSave(
    form,
    saveEmergencyContact,
    done,
    contact ? "Contact updated" : "Contact added",
  );
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-4 rounded-control border border-hairline bg-surface-sunken/50 p-4 sm:grid-cols-3"
    >
      <Field label="Name" error={errors.name?.message}>
        <Input {...form.register("name")} />
      </Field>
      <Field label="Relationship" error={errors.relationship?.message}>
        <Input placeholder="Mother, partner…" {...form.register("relationship")} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input type="tel" {...form.register("phone")} />
      </Field>
      <Controller
        control={form.control}
        name="isPrimary"
        render={({ field }) => (
          <label className="flex items-center gap-2.5 text-body text-ink sm:col-span-3">
            <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
            Call this person first
          </label>
        )}
      />
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button type="button" variant="ghost" onClick={done}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {contact ? "Save contact" : "Add contact"}
        </Button>
      </div>
    </form>
  );
}

export function EmergencyContacts({
  employeeId,
  contacts,
  canEdit,
  firstName,
}: {
  employeeId: string;
  contacts: ContactRow[];
  canEdit: boolean;
  firstName: string;
}) {
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const [removing, setRemoving] = React.useState<ContactRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function remove(c: ContactRow) {
    startTransition(async () => {
      const r = await deleteEmergencyContact({ employeeId, id: c.id });
      if (!r.ok) toast.error("Couldn't remove the contact", { description: r.error });
      else toast.success(`Removed ${c.name}`);
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {contacts.length === 0 && editing !== "new" && (
        <p className="rounded-control border border-dashed border-border-strong px-4 py-5 text-center text-small text-ink-muted">
          No emergency contacts yet.{" "}
          {canEdit
            ? "Add someone we can call if something happens at work."
            : `${firstName} hasn't added anyone.`}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {contacts.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <ContactForm employeeId={employeeId} contact={c} done={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-control border border-hairline px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink-muted">
                <Phone className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-body font-medium text-ink">
                  {c.name}
                  {c.isPrimary && (
                    <span className="inline-flex items-center gap-1 text-caption font-medium text-highlight-ink">
                      <Star className="size-3 fill-current" aria-hidden /> Call first
                    </span>
                  )}
                </p>
                <p className="text-small text-ink-muted">
                  {c.relationship} ·{" "}
                  <a href={`tel:${c.phone}`} className="font-mono num hover:text-accent">
                    {c.phone}
                  </a>
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(c.id)}
                    aria-label={`Edit ${c.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoving(c)}
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {canEdit &&
        (editing === "new" ? (
          <ContactForm employeeId={employeeId} done={() => setEditing(null)} />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setEditing("new")}
          >
            <Plus aria-hidden /> Add a contact
          </Button>
        ))}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent size="sm">
          <DialogHeader
            title={`Remove ${removing?.name}?`}
            description="They won't be contacted in an emergency any more. You can add them again later."
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() => removing && remove(removing)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
