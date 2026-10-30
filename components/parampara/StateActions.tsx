import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";

/** One action in an empty or error state: a link (works from server components) or a handler. */
export type StateAction = {
  label: MessageKey;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
};

export function StateActionButton({
  action,
  variant,
  className,
}: {
  action: StateAction;
  variant: "clay" | "paper" | "ghost";
  className?: string;
}) {
  const Icon = action.icon;
  const inner = (
    <>
      {Icon && <Icon aria-hidden />}
      <Bi k={action.label} sub={false} />
    </>
  );
  const cls = cn("w-full max-w-sm", className);
  if (action.href) {
    return (
      <Button asChild variant={variant} className={cls}>
        <Link href={action.href}>{inner}</Link>
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} onClick={action.onClick} className={cls}>
      {inner}
    </Button>
  );
}
