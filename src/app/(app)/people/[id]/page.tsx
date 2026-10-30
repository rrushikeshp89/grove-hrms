import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { ProfileSkeleton } from "@/components/ui/states";
import { describeActivity } from "@/features/people/activity";
import { ProfileView } from "@/features/people/components/profile-view";
import { getJobOptions, getProfile } from "@/features/people/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

async function Profile({ params, searchParams }: PageProps<"/people/[id]">) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const profile = await getProfile(user, id);
  const [activity, jobOptions] = await Promise.all([
    describeActivity(profile.activity, profile.employee.joinDate),
    profile.access.editJob ? getJobOptions() : null,
  ]);
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  return <ProfileView profile={profile} activity={activity} jobOptions={jobOptions} tab={tab} />;
}

export default function ProfilePage(props: PageProps<"/people/[id]">) {
  return (
    <PageContainer>
      <Link
        href="/people"
        className="mb-6 inline-flex items-center gap-1.5 text-small font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> People
      </Link>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile {...props} />
      </Suspense>
    </PageContainer>
  );
}
