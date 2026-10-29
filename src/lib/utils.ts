import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom scale so `text-small` and `text-ink` don't
// get treated as the same conflicting group.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display-xl", "display", "title", "heading", "body", "small", "caption"] },
      ],
      shadow: [{ shadow: ["xs", "sm", "md", "lg", "press"] }],
      rounded: [{ rounded: ["xs", "sm", "control", "card", "overlay"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
