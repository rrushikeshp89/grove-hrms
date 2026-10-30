import { SearchX, UserRoundX, Users } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function PersonNotFound() {
  return (
    <EmptyState
      icon={UserRoundX}
      satellites={[SearchX, Users]}
      title="We couldn't find that person"
      description="They may have left the company, or the link is out of date. Search the directory instead."
      action={
        <Button asChild>
          <Link href="/people">Go to the directory</Link>
        </Button>
      }
    />
  );
}
