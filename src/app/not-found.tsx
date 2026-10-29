import { Compass, MapPinOff, Signpost } from "lucide-react";
import Link from "next/link";

import { BrandMark, Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <Link href="/" className="mb-10 flex items-center gap-2.5" aria-label="Grove home">
        <BrandMark />
        <Wordmark />
      </Link>
      <EmptyState
        icon={Signpost}
        satellites={[MapPinOff, Compass]}
        title="This page isn't here"
        description="The link may be old, or the page may have moved. Head back and pick up where you left off."
        action={
          <Button asChild>
            <Link href="/">Go to Grove</Link>
          </Button>
        }
      />
    </main>
  );
}
