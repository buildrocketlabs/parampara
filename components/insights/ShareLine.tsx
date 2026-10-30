"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { Bi } from "@/components/parampara/Bi";
import type { Bilingual } from "@/lib/domain/fln";
import { haptics, vibrate } from "@/lib/motion";
import { cn } from "@/lib/utils";

// An action the officer cannot do inside Parampara (record a master, remind teachers) still gets a
// thumb target: send the line, in Kannada and English, to a CRP or a cluster WhatsApp group. The
// line is aggregate only (Law 6), so it is safe to forward. Share sheet first, else the clipboard.
export function ShareLine({ text, className }: { text: Bilingual; className?: string }) {
  const [done, setDone] = useState(false);

  async function send() {
    vibrate(haptics.press);
    const body = `${text.kn}\n\n${text.en}\n\n(Parampara)`;
    try {
      if (navigator.share) {
        await navigator.share({ text: body });
        return;
      }
      await navigator.clipboard.writeText(body);
      setDone(true);
      window.setTimeout(() => setDone(false), 2400);
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      data-share-line
      className={cn(
        "inline-flex min-h-12 shrink-0 items-center gap-1.5 self-start rounded-chip bg-flame px-4 font-display text-[15px] font-bold text-ink transition-[translate] outline-none hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-white active:translate-y-px",
        className,
      )}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
      <span role="status" aria-live="polite">
        <Bi k={done ? "pulse.do.copied" : "pulse.do.send"} sub={false} />
      </span>
    </button>
  );
}
