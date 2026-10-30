"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

import { saveTemplate } from "../actions";
import { ASSIGNEES, ASSIGNEE_LABELS } from "../logic/checklist";
import type { Template } from "../queries";
import { templateSchema, type TemplateInput } from "../schemas";

/**
 * Tasks for one template. Saving only affects checklists started from now
 * on; anything already running keeps its own copy.
 */
export function TemplateEditor({ template }: { template: Template }) {
  const router = useRouter();
  const form = useForm<TemplateInput, unknown, z.output<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      templateId: template.id,
      tasks: template.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? "",
        assigneeRole: t.assigneeRole,
        dueOffsetDays: t.dueOffsetDays,
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tasks" });
  const { errors, isSubmitting, isDirty } = form.formState;
  const anchor = template.kind === "ONBOARDING" ? "first day" : "last day";
  const labels = ASSIGNEE_LABELS[template.kind];

  const submit = form.handleSubmit(async () => {
    const r = await saveTemplate(form.getValues());
    if (!r.ok) {
      toast.error("Template not saved", { description: r.error });
      return;
    }
    toast.success("Template saved", { description: "New checklists will use it." });
    form.reset(form.getValues());
    router.refresh();
  });

  return (
    <Card>
      <CardHeader
        title={template.name}
        description={`Due days count from the ${anchor}. Use a minus for days before.`}
      />
      <form onSubmit={submit} noValidate>
        <CardBody className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <fieldset
              key={f.id}
              className="grid items-start gap-3 border-b border-hairline pb-3 last:border-0 sm:grid-cols-[1fr_9rem_6rem_auto]"
            >
              <legend className="sr-only">Task {i + 1}</legend>
              <Field label="Task" error={errors.tasks?.[i]?.title?.message}>
                <Input {...form.register(`tasks.${i}.title`)} />
              </Field>
              <Field label="Owner">
                <Controller
                  control={form.control}
                  name={`tasks.${i}.assigneeRole`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNEES.map((a) => (
                          <SelectItem key={a} value={a}>
                            {labels[a]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Due day" error={errors.tasks?.[i]?.dueOffsetDays?.message}>
                <Input type="number" {...form.register(`tasks.${i}.dueOffsetDays`)} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6 text-ink-subtle"
                aria-label={`Remove task ${i + 1}`}
                onClick={() => remove(i)}
              >
                <Trash2 aria-hidden />
              </Button>
            </fieldset>
          ))}
          {errors.tasks?.root?.message && (
            <p role="alert" className="text-small font-medium text-danger">
              {errors.tasks.root.message}
            </p>
          )}
        </CardBody>
        <div className="flex flex-col-reverse gap-2 border-t border-hairline px-5 py-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              append({ title: "", description: "", assigneeRole: "HR", dueOffsetDays: 0 })
            }
          >
            <Plus aria-hidden /> Add a task
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            <Save aria-hidden /> Save template
          </Button>
        </div>
      </form>
    </Card>
  );
}
