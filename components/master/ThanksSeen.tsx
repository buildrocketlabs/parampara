"use client";

import { useEffect } from "react";
import { markThanksRead } from "@/app/m/actions";

// The master has seen their room: new thank you notes become delivered (0005). Renders nothing.
export function ThanksSeen({ pending }: { pending: number }) {
  useEffect(() => {
    if (pending > 0) void markThanksRead().catch(() => 0);
  }, [pending]);
  return null;
}
