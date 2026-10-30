"use client";

import { useId } from "react";
import { Bi } from "@/components/parampara/Bi";

// The optional note when a reviewer marks a question handled. A visible label in the reader's
// language (CSS switches it, like every Bi), so no placeholder can show the wrong language.
export function QueueNote() {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
      <label htmlFor={id} className="text-[14px] font-semibold text-ink-3">
        <Bi k="queue.note" sub={false} />
      </label>
      <input
        id={id}
        name="note"
        maxLength={400}
        className="h-12 w-full min-w-0 rounded-button border border-input bg-paper px-4 text-base outline-none focus:border-clay focus:shadow-flame"
      />
    </div>
  );
}
