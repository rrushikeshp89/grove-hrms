import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { DashboardSkeleton } from "@/components/ui/states";
import { HomeView } from "@/features/home/components/home-view";
import { getHomeData } from "@/features/home/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Home" };

async function Home() {
  const user = await requireUser();
  const data = await getHomeData(user);
  return <HomeView user={user} data={data} />;
}

export default function HomePage() {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardSkeleton />}>
        <Home />
      </Suspense>
    </PageContainer>
  );
}
