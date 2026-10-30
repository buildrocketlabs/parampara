"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { closeInvite } from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { haptics, vibrate } from "@/lib/motion";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { SubmitButton } from "./SubmitButton";

// Small client pieces of the invite list: copy to the clipboard, and revoke in two steps.

export function CopyButton({
  text,
  label = "invites.copy",
  variant = "paper",
  className,
}: {
  text: string;
  label?: MessageKey;
  variant?: "paper" | "ink";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older in-app browsers: fall back to a hidden textarea.
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    vibrate(haptics.press);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Button type="button" variant={variant} size="md" onClick={copy} className={className}>
      {copied ? <Check aria-hidden className="text-moss" /> : <Copy aria-hidden />}
      <span aria-live="polite">
        <Bi k={copied ? "invites.copied" : label} sub={false} />
      </span>
    </Button>
  );
}

export function RevokeControl({ code }: { code: string }) {
  const [asking, setAsking] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) yes.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => setAsking(true)}
        className="text-ink-3 hover:text-ink"
      >
        <X aria-hidden />
        <Bi k="invites.revoke" sub={false} />
      </Button>
    );
  }

  return (
    <div
      role="group"
      className={cn("flex w-full flex-wrap items-center gap-2 rounded-button bg-cream p-2 pl-3")}
      onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
    >
      <p className="mr-auto text-[15px] font-semibold text-ink">
        <Bi k="invites.revoke.confirm" sub={false} />
      </p>
      <Button type="button" variant="ghost" size="md" onClick={() => setAsking(false)}>
        <Bi k="invites.revoke.keep" sub={false} />
      </Button>
      <form action={closeInvite.bind(null, code)}>
        <SubmitButton ref={yes} variant="ink" size="md" pendingLabel="invites.revoking">
          <Bi k="invites.revoke.yes" sub={false} />
        </SubmitButton>
      </form>
    </div>
  );
}
