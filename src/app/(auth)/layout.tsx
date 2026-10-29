import { CalendarCheck, Inbox, Network, Sprout } from "lucide-react";
import Link from "next/link";

import { BrandMark, Wordmark } from "@/components/shell/brand";

const POINTS = [
  {
    icon: CalendarCheck,
    text: "Time off that checks holidays and who else is away before you ask.",
  },
  { icon: Inbox, text: "One calm inbox for every approval, with undo." },
  { icon: Network, text: "An org chart that is always up to date, because it is the data." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-accent text-accent-fg lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Sprout
          aria-hidden
          strokeWidth={0.6}
          className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] opacity-[0.07]"
        />
        <Link href="/login" className="flex items-center gap-2.5" aria-label="Grove">
          <span className="grid size-8 place-items-center rounded-[9px] bg-accent-fg/15">
            <Sprout className="size-[18px]" aria-hidden />
          </span>
          <span className="font-display-soft text-[1.375rem] leading-none font-medium tracking-[-0.02em]">
            Grove
          </span>
        </Link>
        <div className="relative max-w-md">
          <p className="font-display-soft text-display font-medium">
            People first.
            <br />
            Paperwork second.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-body text-accent-fg">
                <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-small text-accent-fg">Northwind Grove · demo workspace</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link
          href="/login"
          className="flex items-center gap-2.5 self-start lg:hidden"
          aria-label="Grove"
        >
          <BrandMark />
          <Wordmark />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
