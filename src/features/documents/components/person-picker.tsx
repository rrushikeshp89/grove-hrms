"use client";

import { useRouter } from "next/navigation";

import { Combobox } from "@/components/ui/combobox";

/** Chooses whose folder to open; the choice lives in the URL. */
export function PersonPicker({
  people,
  value,
}: {
  people: { id: string; name: string; title: string }[];
  value: string | null;
}) {
  const router = useRouter();
  return (
    <div className="max-w-sm">
      <Combobox
        aria-label="Whose folder"
        value={value}
        onChange={(id) =>
          router.replace(id ? `/documents?view=people&person=${id}` : "/documents?view=people")
        }
        placeholder="Choose someone"
        searchPlaceholder="Search people"
        options={people.map((p) => ({ value: p.id, label: p.name, hint: p.title }))}
      />
    </div>
  );
}
