import * as React from "react";

import { cn } from "@/lib/utils";

import type { Doc, Node } from "../logic/content";

/**
 * Renders a stored announcement body. It only ever receives a document that
 * `sanitizeDoc` has rebuilt, so every node and mark here is one we allow.
 * No HTML strings and no dangerouslySetInnerHTML: it's all React elements.
 */
function renderText(node: Node, key: number): React.ReactNode {
  let out: React.ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong className="font-semibold text-ink">{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "strike") out = <s>{out}</s>;
    else if (mark.type === "code")
      out = <code className="rounded-xs bg-surface-sunken px-1 font-mono text-[0.9em]">{out}</code>;
    else if (mark.type === "link" && mark.attrs)
      out = (
        <a
          href={mark.attrs.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          {out}
        </a>
      );
  }
  return <React.Fragment key={key}>{out}</React.Fragment>;
}

function renderNode(node: Node, key: number): React.ReactNode {
  const kids = (node.content ?? []).map((c, i) =>
    c.type === "text" ? renderText(c, i) : renderNode(c, i),
  );
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="text-body leading-relaxed text-ink-muted">
          {kids}
        </p>
      );
    case "heading":
      return node.attrs?.level === 3 ? (
        <h4 key={key} className="mt-1 text-body font-semibold text-ink">
          {kids}
        </h4>
      ) : (
        <h3 key={key} className="mt-2 text-heading font-semibold text-ink">
          {kids}
        </h3>
      );
    case "bulletList":
      return (
        <ul
          key={key}
          className="ml-5 list-disc space-y-1 text-body text-ink-muted marker:text-ink-subtle"
        >
          {kids}
        </ul>
      );
    case "orderedList":
      return (
        <ol
          key={key}
          className="ml-5 list-decimal space-y-1 text-body text-ink-muted marker:text-ink-subtle"
        >
          {kids}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids}</li>;
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-accent/40 pl-4 text-body text-ink-muted italic"
        >
          {kids}
        </blockquote>
      );
    case "hardBreak":
      return <br key={key} />;
    default:
      return null;
  }
}

export function RichText({ doc, className }: { doc: Doc; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {doc.content.map((n, i) => renderNode(n, i))}
    </div>
  );
}
