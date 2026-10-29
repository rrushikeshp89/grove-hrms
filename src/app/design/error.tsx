"use client";

import Link from "next/link";

import { PageContainer } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function DesignError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <ErrorState
        title="This page hit a snag"
        description="Something in this section failed to render. Trying again usually fixes it; if not, the other design pages still work."
        reference={error.digest}
        onRetry={reset}
        secondaryAction={
          <Button variant="ghost" asChild>
            <Link href="/design">Back to foundations</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
