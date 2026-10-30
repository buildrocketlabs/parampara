import { enterAs } from "@/app/actions/session";
import type { AppRole } from "@/lib/auth/roles";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";
import { DoorSubmit } from "./DoorSubmit";
import { ROLE_ICON, ROLE_NAME } from "./role-meta";

// One tap demo entry for a role (DESIGN §8 `/`, BRIEF §7.1). The door is a form: its submit signs
// in to the role's Sample demo account on the server and opens the room, with or without JS.
// The button is stretched over the whole card, so the card is one big target.
type RoleDoorProps = {
  role: AppRole;
  body: MessageKey;
  featured?: boolean;
  /** The room behind the door is still a preview; the chip says so. The entry itself is real. */
  preview?: boolean;
  index: number;
};

export function RoleDoor({ role, body, featured = false, preview = true, index }: RoleDoorProps) {
  const Icon = ROLE_ICON[role];
  const titleId = `door-${role}-title`;

  return (
    <form
      action={enterAs.bind(null, role, undefined)}
      data-door={role}
      style={{ "--i": index } as React.CSSProperties}
      className={cn(
        "group relative flex min-h-36 rise flex-col rounded-card p-5 transition-[translate,scale,box-shadow] duration-200 ease-gentle sm:min-h-48 sm:p-6",
        "hover:-translate-y-1 has-[button:active]:translate-y-0 has-[button:active]:scale-98 has-[button:active]:duration-100",
        "has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-3 has-[button:focus-visible]:outline-clay",
        featured
          ? "bg-ink text-white shadow-warm-lg hover:shadow-flame"
          : "border border-border bg-paper text-ink shadow-warm hover:shadow-warm-lg",
      )}
    >
      <span className="mb-3 flex items-start justify-between gap-3 sm:mb-5">
        <span
          className={cn(
            "grid size-14 place-items-center rounded-chip",
            featured ? "bg-flame text-ink" : "bg-sage text-ink-2",
          )}
        >
          <Icon className="size-7" strokeWidth={2.2} aria-hidden />
        </span>
        {preview && (
          <span
            className={cn(
              "rounded-chip px-3 py-1 text-sm font-semibold",
              featured ? "bg-ink-2 text-mist" : "bg-cream text-ink-3",
            )}
          >
            <Bi k="door.soon" sub={false} />
          </span>
        )}
      </span>
      <h3 id={titleId} className="text-[26px] leading-tight font-bold">
        <Bi
          k={ROLE_NAME[role]}
          subClassName={cn("font-sans text-base font-medium", featured && "text-mist")}
        />
      </h3>
      <p className="mt-3 text-lg">
        <Bi
          k={body}
          className={featured ? "text-white" : "text-ink-3"}
          subClassName={cn("text-[15px]", featured && "text-mist")}
        />
      </p>
      <DoorSubmit titleId={titleId} featured={featured} />
    </form>
  );
}
