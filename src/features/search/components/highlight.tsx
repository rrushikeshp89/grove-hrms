import * as React from "react";

import { highlightSegments } from "../highlight";

/** Text with the parts that match the query marked, for search results. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const segments = highlightSegments(text, query);
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-sm bg-accent-subtle px-0.5 font-medium text-accent">
            {s.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        ),
      )}
    </>
  );
}
