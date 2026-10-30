"use client";

import { RotateCcw } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import type { Text, Vars } from "@/lib/i18n/fill";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";
import { StateActionButton, type StateAction } from "./StateActions";

// Never a raw error (DESIGN §2.7). Hanate cares, says what happened in plain words, offers a retry
// and, where it exists, the way around it (type instead of speak, read instead of listen).
export type ErrorStateProps = {
  /** Short headline. Defaults to "Something went wrong". */
  title?: Text;
  /** What happened and what to do, in one or two short sentences. */
  body?: Text;
  vars?: Vars;
  /** Defaults to reloading the page, so an error is never a dead end. Pass `false` for no retry. */
  onRetry?: (() => void) | false;
  retryLabel?: MessageKey;
  /** The text fallback, for example { label: "state.typeInstead", href: "/t/ask?mode=text" }. */
  fallback?: StateAction;
  /** A small reference for support (an error code or job id). Never a stack trace. */
  reference?: string;
  size?: "page" | "inline";
  className?: string;
};

export function ErrorState({
  title = "error.title",
  body = "error.body",
  vars,
  onRetry,
  retryLabel = "error.retry",
  fallback,
  reference,
  size = "inline",
  className,
}: ErrorStateProps) {
  const page = size === "page";
  const retry = onRetry === false ? undefined : (onRetry ?? (() => window.location.reload()));
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center text-center", page ? "py-10" : "py-4", className)}
    >
      <Hanate state="caring" size={page ? 150 : 104} label="" />
      <h2
        className={cn(
          "mt-4 leading-tight font-bold text-ink",
          page ? "text-[30px]" : "text-[24px]",
        )}
      >
        <BiText text={title} vars={vars} subClassName="font-sans text-[16px] font-semibold" />
      </h2>
      <p className="mt-2 max-w-sm text-lg text-ink-3">
        <BiText text={body} vars={vars} subClassName="text-[15px]" />
      </p>
      {(retry || fallback) && (
        <div className="mt-6 flex w-full flex-col items-center gap-3">
          {retry && (
            <StateActionButton
              variant="clay"
              action={{ label: retryLabel, onClick: retry, icon: RotateCcw }}
            />
          )}
          {fallback && <StateActionButton variant={retry ? "paper" : "clay"} action={fallback} />}
        </div>
      )}
      {reference && (
        <p className="mt-4 font-mono text-[14px] text-muted-foreground" translate="no">
          {reference}
        </p>
      )}
    </div>
  );
}
