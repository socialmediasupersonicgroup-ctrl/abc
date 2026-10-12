import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Record not found"
      description="It may have been deleted, or it belongs to a different workspace."
      action={
        <Button asChild variant="outline">
          <Link href="/">Back to overview</Link>
        </Button>
      }
    />
  );
}
