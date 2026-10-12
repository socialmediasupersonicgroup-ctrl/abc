"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page couldn't be loaded"
      description="Something went wrong while reading your data. Your records are safe — try again, and if the problem continues check the server logs."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
