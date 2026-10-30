"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics, vibrate } from "@/lib/motion";
import type { MessageKey } from "@/lib/i18n";
import { useOfflineQueue } from "@/lib/use-offline-queue";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { Ember } from "./Ember";

// A form's submit as a ChunkyButton (DESIGN §4) with honest states: it sinks on press within
// 100 ms and says what is happening while the server works. Pressed offline, it holds the press
// and sends it when the network returns (Law 9). Works without JavaScript (a plain submit).
type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type" | "children"> & {
  children: ReactNode;
  pendingLabel: MessageKey;
  /** Classes for the pending and offline words (e.g. hide them beside an icon on phones). */
  labelClassName?: string;
};

export function SubmitButton({
  children,
  pendingLabel,
  labelClassName,
  disabled,
  onClick,
  name,
  value,
  ...props
}: SubmitButtonProps) {
  const { pending, data } = useFormStatus();
  const { held, hold } = useOfflineQueue();
  // A form with several submit buttons only shows the pressed one as busy.
  const mine = pending && (!name || data?.get(name) === value);
  const isHeld = held !== null && (!name || held === String(value ?? ""));

  return (
    <Button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={mine || isHeld || undefined}
      onClick={(e) => {
        vibrate(haptics.press);
        if (hold(e)) return;
        onClick?.(e);
      }}
      {...props}
    >
      {isHeld ? (
        <>
          <CloudOff aria-hidden />
          <span className={cn("flex flex-col text-[0.85em] leading-tight whitespace-normal", labelClassName)}>
            <Bi k="offline.held" sub={false} />
            <span className="mt-0.5 text-[0.85em] font-semibold opacity-90">
              <Bi k="offline.cancel" sub={false} />
            </span>
          </span>
        </>
      ) : mine ? (
        <>
          <Ember />
          <span className={labelClassName}>
            <Bi k={pendingLabel} sub={false} />
          </span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
