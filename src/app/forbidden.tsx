import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function Forbidden() {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4">
      <EmptyState
        icon={Lock}
        satellites={[ShieldCheck, KeyRound]}
        title="This page isn't part of your role"
        description="Your access is set by your role in Grove. If you need this page for your work, ask an admin or HR to review your access."
        action={
          <Button asChild>
            <Link href="/home">Back to home</Link>
          </Button>
        }
      />
    </main>
  );
}
