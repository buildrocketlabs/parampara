import { ArrowRight } from "lucide-react";
import { enterAs } from "@/app/actions/session";
import type { AppRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { ROLE_ENTER } from "./role-meta";
import { SubmitButton } from "./SubmitButton";

// "Enter as teacher (demo)": the one tap way in wherever a page needs a session it does not have,
// so a room visited directly is never a dead end.
export function EnterAs({
  role,
  next,
  className,
}: {
  role: AppRole;
  /** Return here after entering (must sit inside the role's area, e.g. /r/invites). */
  next?: string;
  className?: string;
}) {
  return (
    <form action={enterAs.bind(null, role, next)} className={cn("w-full", className)}>
      <SubmitButton pendingLabel="door.pending" className="w-full">
        <Bi k={ROLE_ENTER[role]} sub={false} />
        <ArrowRight aria-hidden />
      </SubmitButton>
    </form>
  );
}
