"use client";

import Link from "next/link";

import { PageContainer } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <ErrorState
        title="We couldn't load this page"
        description="Something went wrong while fetching your data. Nothing you saved earlier was lost. Trying again usually fixes it."
        reference={error.digest}
        onRetry={reset}
        secondaryAction={
          <Button variant="ghost" asChild>
            <Link href="/home">Go to home</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
