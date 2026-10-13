"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  // reset() alone re-renders the cached server payload (which still holds the error); refresh refetches it.
  const retry = () => React.startTransition(() => {
    router.refresh();
    reset();
  });
  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page couldn't be loaded"
      description="Something went wrong while reading your data. Your records are safe — try again, and if the problem continues check the server logs."
      action={<Button onClick={retry}>Try again</Button>}
    />
  );
}
