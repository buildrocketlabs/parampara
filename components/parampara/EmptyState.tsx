import type { Text, Vars } from "@/lib/i18n/fill";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";
import { Hanate } from "./hanate/Hanate";
import type { HanateState } from "./hanate/variants";
import { StateActionButton, type StateAction } from "./StateActions";

// Empty states invite (DESIGN §2.7): Hanate, one line, one action. Nothing else.
export type EmptyStateProps = {
  title: Text;
  /** One quiet sentence on why it is empty or what will appear. */
  body?: Text;
  vars?: Vars;
  action?: StateAction;
  /** idle for "nothing yet", resting for "nothing while offline". */
  hanate?: HanateState;
  size?: "page" | "inline";
  className?: string;
};

export function EmptyState({
  title,
  body,
  vars,
  action,
  hanate = "idle",
  size = "inline",
  className,
}: EmptyStateProps) {
  const page = size === "page";
  return (
    <div
      className={cn("flex flex-col items-center text-center", page ? "py-12" : "py-4", className)}
    >
      <Hanate state={hanate} size={page ? 150 : 104} label="" />
      <h2
        className={cn(
          "mt-4 leading-tight font-bold text-ink",
          page ? "text-[30px]" : "text-[24px]",
        )}
      >
        <BiText text={title} vars={vars} subClassName="font-sans text-[16px] font-semibold" />
      </h2>
      {body && (
        <p className="mt-2 max-w-sm text-lg text-ink-3">
          <BiText text={body} vars={vars} subClassName="text-[15px]" />
        </p>
      )}
      {action && <StateActionButton variant="clay" action={action} className="mt-6" />}
    </div>
  );
}
