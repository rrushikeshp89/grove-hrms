"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Save,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { saveAnnouncement } from "../actions";
import type { Doc } from "../logic/content";

type Option = { id: string; name: string };

function ToolButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep the editor focused, so a click formats the selection instead of dropping it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
        active && "bg-accent-subtle text-accent",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      bullets: e.isActive("bulletList"),
      numbers: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });
  const [linking, setLinking] = React.useState(false);
  const [url, setUrl] = React.useState("");

  function applyLink() {
    const href = url.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: /^[a-z]+:/i.test(href) ? href : `https://${href}` })
        .run();
    setLinking(false);
    setUrl("");
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b border-hairline p-1.5"
    >
      <ToolButton
        label="Bold"
        icon={Bold}
        active={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        label="Italic"
        icon={Italic}
        active={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        label="Heading"
        icon={Heading2}
        active={s.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label="Bulleted list"
        icon={List}
        active={s.bullets}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered list"
        icon={ListOrdered}
        active={s.numbers}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        label="Quote"
        icon={Quote}
        active={s.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        label="Link"
        icon={LinkIcon}
        active={s.link || linking}
        onClick={() => {
          setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
          setLinking((v) => !v);
        }}
      />
      {linking && (
        <form
          className="ml-1 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <Input
            aria-label="Link address"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 w-56"
            autoFocus
          />
          <Button type="submit" size="sm" variant="secondary">
            {url.trim() ? "Apply" : "Remove"}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * Writing an announcement. The editor only offers what the renderer can show
 * (headings, bold, italic, lists, quotes, links); the server rebuilds the
 * document again before saving, so nothing else gets through.
 */
export function AnnouncementEditor({
  initial,
  departments,
  locations,
}: {
  initial?: {
    id: string;
    title: string;
    body: Doc;
    pinned: boolean;
    published: boolean;
    departmentIds: string[];
    locationIds: string[];
  };
  departments: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [pinned, setPinned] = React.useState(initial?.pinned ?? false);
  const [depts, setDepts] = React.useState<string[]>(initial?.departmentIds ?? []);
  const [locs, setLocs] = React.useState<string[]>(initial?.locationIds ?? []);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer nofollow" },
        },
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        code: false,
        strike: false,
      }),
    ],
    content: initial?.body ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Announcement body",
        class:
          "min-h-56 px-4 py-3 text-body leading-relaxed text-ink outline-none [&_h2]:mt-3 [&_h2]:text-heading [&_h2]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-accent [&_a]:underline [&_p]:my-2",
      },
    },
  });

  const toggle = (list: string[], set: (v: string[]) => void, id: string, on: boolean) =>
    set(on ? [...list, id] : list.filter((x) => x !== id));

  function save(publish: boolean) {
    if (!editor) return;
    startTransition(async () => {
      const r = await saveAnnouncement({
        id: initial?.id ?? null,
        title,
        body: editor.getJSON(),
        departmentIds: depts,
        locationIds: locs,
        pinned,
        publish,
      });
      if (!r.ok) {
        const next: Record<string, string> = {};
        for (const [f, m] of Object.entries(r.fieldErrors ?? {})) next[f] = m[0]!;
        setErrors(next);
        if (!r.fieldErrors) toast.error("Couldn't save", { description: r.error });
        return;
      }
      toast.success(
        publish
          ? initial?.published
            ? "Changes published"
            : "Announcement published"
          : "Draft saved",
      );
      router.push("/announcements");
    });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
      className="grid items-start gap-4 lg:grid-cols-3"
    >
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Field label="Headline" error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Office closed on Friday for Diwali"
          />
        </Field>
        <div>
          <p className="mb-1.5 text-body font-medium text-ink">Message</p>
          <div className="rounded-control border border-border-input bg-surface focus-within:ring-2 focus-within:ring-accent/40">
            {editor ? (
              <Toolbar editor={editor} />
            ) : (
              <div className="h-11 border-b border-hairline" />
            )}
            <EditorContent editor={editor} />
          </div>
          {errors.body && (
            <p role="alert" className="mt-1.5 text-small font-medium text-danger">
              {errors.body}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader
            title="Who sees it"
            description={depts.length || locs.length ? "Only the people you pick" : "Everyone"}
          />
          <CardBody className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 eyebrow">Teams</legend>
              <div className="grid gap-1.5">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2.5 text-body text-ink">
                    <Checkbox
                      checked={depts.includes(d.id)}
                      onCheckedChange={(v) => toggle(depts, setDepts, d.id, v === true)}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 eyebrow">Locations</legend>
              <div className="grid gap-1.5">
                {locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2.5 text-body text-ink">
                    <Checkbox
                      checked={locs.includes(l.id)}
                      onCheckedChange={(v) => toggle(locs, setLocs, l.id, v === true)}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </CardBody>
        </Card>
        <label className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-5 py-4 text-body text-ink">
          <span>
            Pin to the top
            <span className="block text-small text-ink-muted">
              For things everyone needs to see
            </span>
          </span>
          <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Pin to the top" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            <Send aria-hidden /> {initial?.published ? "Publish changes" : "Publish"}
          </Button>
          {!initial?.published && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => save(false)}
            >
              <Save aria-hidden /> Save draft
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
