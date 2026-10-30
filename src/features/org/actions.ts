"use server";

import { revalidatePath } from "next/cache";

import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";

import { deleteSchema, departmentSchema, designationSchema } from "./schemas";

function refresh() {
  revalidatePath("/departments");
  revalidatePath("/people");
  revalidatePath("/org");
}

export const saveDepartment = createAction({
  schema: departmentSchema,
  permission: "org.manage",
  handler: async ({ input, tx, audit }) => {
    const { id, ...data } = input;
    const clash = await tx.department.findFirst({
      where: {
        OR: [{ name: { equals: data.name, mode: "insensitive" } }, { code: data.code }],
        id: id ? { not: id } : undefined,
      },
      select: { name: true, code: true },
    });
    if (clash) {
      const field = clash.code === data.code ? "code" : "name";
      throw new ActionError("Another department already uses that.", {
        [field]: [
          field === "code"
            ? `${data.code} is taken by ${clash.name}`
            : `${clash.name} already exists`,
        ],
      });
    }
    if (data.headId) {
      const head = await tx.employee.findUnique({
        where: { id: data.headId },
        select: { status: true, headOf: { select: { id: true, name: true } } },
      });
      if (!head || head.status === "EXITED")
        throw new ActionError("Choose someone who still works here.", {
          headId: ["Choose a current employee"],
        });
      if (head.headOf && head.headOf.id !== id) {
        throw new ActionError("They already lead another department.", {
          headId: [`Already heads ${head.headOf.name}`],
        });
      }
    }
    const before = id ? await tx.department.findUnique({ where: { id } }) : null;
    const saved = id
      ? await tx.department.update({ where: { id }, data })
      : await tx.department.create({ data });
    audit({
      action: id ? "department.update" : "department.create",
      entityType: "Department",
      entityId: saved.id,
      before: before ? { name: before.name, code: before.code, headId: before.headId } : undefined,
      after: { name: saved.name, code: saved.code, headId: saved.headId },
    });
    refresh();
    return { id: saved.id };
  },
});

export const deleteDepartment = createAction({
  schema: deleteSchema,
  permission: "org.manage",
  handler: async ({ input, tx, audit }) => {
    const dept = await tx.department.findUnique({
      where: { id: input.id },
      select: { name: true, _count: { select: { employees: true, jobPostings: true } } },
    });
    if (!dept) return { deleted: false };
    if (dept._count.employees > 0) {
      throw new ActionError(
        `${dept.name} still has ${dept._count.employees} people on record, including former employees. Move them first.`,
      );
    }
    if (dept._count.jobPostings > 0)
      throw new ActionError(`${dept.name} has job postings. Close or move them first.`);
    await tx.designation.deleteMany({ where: { departmentId: input.id } });
    await tx.department.delete({ where: { id: input.id } });
    audit({
      action: "department.delete",
      entityType: "Department",
      entityId: input.id,
      before: { name: dept.name },
    });
    refresh();
    return { deleted: true };
  },
});

export const saveDesignation = createAction({
  schema: designationSchema,
  permission: "org.manage",
  handler: async ({ input, tx, audit }) => {
    const { id, ...data } = input;
    const clash = await tx.designation.findFirst({
      where: {
        departmentId: data.departmentId,
        title: { equals: data.title, mode: "insensitive" },
        id: id ? { not: id } : undefined,
      },
    });
    if (clash)
      throw new ActionError("That title already exists here.", {
        title: [`${clash.title} already exists in this department`],
      });
    const saved = id
      ? await tx.designation.update({
          where: { id },
          data: { title: data.title, level: data.level },
        })
      : await tx.designation.create({ data });
    audit({
      action: id ? "designation.update" : "designation.create",
      entityType: "Designation",
      entityId: saved.id,
      after: { title: saved.title, level: saved.level },
    });
    refresh();
    return { id: saved.id };
  },
});

export const deleteDesignation = createAction({
  schema: deleteSchema,
  permission: "org.manage",
  handler: async ({ input, tx, audit }) => {
    const d = await tx.designation.findUnique({
      where: { id: input.id },
      select: { title: true, _count: { select: { employees: true } } },
    });
    if (!d) return { deleted: false };
    if (d._count.employees > 0) {
      throw new ActionError(
        `${d._count.employees} ${d._count.employees === 1 ? "person has" : "people have"} the title ${d.title}. Change theirs first.`,
      );
    }
    await tx.designation.delete({ where: { id: input.id } });
    audit({
      action: "designation.delete",
      entityType: "Designation",
      entityId: input.id,
      before: { title: d.title },
    });
    refresh();
    return { deleted: true };
  },
});
