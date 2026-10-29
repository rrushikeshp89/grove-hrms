import { Suspense } from "react";

import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PageContainer } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/states";
import { requireUser } from "@/server/session";

/**
 * The session read happens inside a Suspense boundary (Cache Components
 * requires it), so the skeleton below streams instantly while we check who
 * you are.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const shellUser: ShellUser = {
    name: user.name,
    email: user.email,
    role: user.role,
    isDemo: user.isDemo,
    designation: user.employee?.designation ?? null,
    avatarUrl: user.employee?.avatarUrl ?? null,
    themePref: user.themePref,
    densityPref: user.densityPref,
  };
  return (
    <AppShell variant="app" user={shellUser}>
      {children}
    </AppShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy>
      <span className="sr-only">Loading Grove</span>
      <aside className="hidden w-[248px] shrink-0 flex-col gap-6 border-r border-hairline px-4 py-4 lg:flex sidebar-collapsed:w-[68px]">
        <span className="flex items-center gap-2.5">
          <BrandMark />
          <Wordmark className="sidebar-collapsed:sr-only" />
        </span>
        <div className="flex flex-col gap-2.5 pt-2">
          {[64, 88, 72].map((w) => (
            <Skeleton key={w} className="h-4" style={{ width: w }} />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="h-14 border-b border-hairline" />
        <PageContainer>
          <DashboardSkeleton />
        </PageContainer>
      </div>
    </div>
  );
}
