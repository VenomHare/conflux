"use client";

import { ErrorState } from "@/components/error-state";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      code="500 · SOMETHING WENT WRONG"
      title="We hit a rough patch."
      description="Something went wrong while opening this page. Your work should still be here when you return."
      onRetry={reset}
    />
  );
}
