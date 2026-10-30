import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { ProfileSkeleton } from "@/components/ui/states";
import { PayslipView } from "@/features/payroll/components/payslip-view";
import { SimulatedBadge } from "@/features/payroll/components/simulated";
import { payslipDetail } from "@/features/payroll/queries";
import { can } from "@/lib/rbac";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Payslip" };

async function Payslip({ params }: { params: PageProps<"/pay/[id]">["params"] }) {
  const user = await requirePermission("payroll.read");
  const { id } = await params;
  const slip = await payslipDetail(user, id);
  if (!slip) notFound();
  const staff = can(actorOf(user), "payroll.run");
  const own = slip.employee.code === user.employee?.code;
  return (
    <>
      <Link
        href={staff && !own ? "/payroll" : "/pay"}
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {staff && !own ? "Payroll" : "Your pay"}
      </Link>
      <PageHeader
        eyebrow={own ? "Payslip" : slip.employee.name}
        title={slip.label}
        actions={<SimulatedBadge />}
      />
      <div className="mt-8">
        <PayslipView slip={slip} downloadHref={`/pay/${slip.id}/pdf`} />
      </div>
    </>
  );
}

export default function PayslipPage({ params }: PageProps<"/pay/[id]">) {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense fallback={<ProfileSkeleton />}>
        <Payslip params={params} />
      </Suspense>
    </PageContainer>
  );
}
