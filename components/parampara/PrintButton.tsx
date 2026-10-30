"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n";
import { Bi } from "./Bi";

/** Opens the browser's print dialog (the page's print CSS keeps only what belongs on paper). */
export function PrintButton({ label, className }: { label: MessageKey; className?: string }) {
  return (
    <Button type="button" variant="paper" className={className} onClick={() => window.print()}>
      <Printer aria-hidden />
      <Bi k={label} sub={false} />
    </Button>
  );
}
