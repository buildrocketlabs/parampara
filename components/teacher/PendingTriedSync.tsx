"use client";

import { useEffect } from "react";
import { recordTried } from "@/app/t/tried/actions";
import { useToast } from "@/components/parampara/Toast";
import { readPending, removePending } from "@/lib/tried/pending";

// Sends "Did it work?" answers that were given with no network (Law 9): on arrival and whenever the
// network comes back. Renders nothing. Mounted by TriedPrompt (the teacher home) and /t/tried.
export function PendingTriedSync() {
  const { toast } = useToast();

  useEffect(() => {
    let running = false;
    const flush = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      let sent = 0;
      for (const item of readPending()) {
        const res = await recordTried(item).catch(() => null);
        // Sent, or refused for good (not hers, or malformed): it leaves the queue. A lapsed session
        // or a failure keeps it for the next try.
        if (res && (res.ok || res.error === "not_found" || res.error === "invalid")) {
          removePending(item.answerId);
        }
        if (res?.ok) sent++;
      }
      running = false;
      if (sent > 0) toast({ text: "tried.sentLater", tone: "success" });
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [toast]);

  return null;
}
