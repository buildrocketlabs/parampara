import { RoomLoading } from "@/components/parampara/RoomLoading";
import { SkeletonLine, SkeletonMedallion } from "@/components/parampara/Skeleton";

// The master's room while it opens: shaped like the room (the greeting with the thank you, the
// impact card, the one button), with Hanate saying what is coming. Never a bare spinner
// (DESIGN §2.7). The pages below (talk, import) share this boundary, so the line speaks of the
// room, not of one page.
export default function Loading() {
  return (
    <RoomLoading line="loading.master" chrome="session" width="narrow">
      <div aria-hidden className="mt-3 rounded-card bg-paper p-5 shadow-warm-sm">
        <div className="flex items-center gap-4">
          <SkeletonMedallion size="lg" />
          <div className="flex-1 space-y-3">
            <SkeletonLine width="80%" className="h-7" />
            <SkeletonLine width="55%" className="h-7" />
          </div>
        </div>
        <SkeletonLine width="90%" className="mt-6 h-5" />
        <SkeletonLine width="60%" className="mt-3 h-5" />
        <span
          aria-hidden
          className="mt-5 block h-16 animate-breathe rounded-button bg-ink/[0.06]"
        />
      </div>
      <span aria-hidden className="mt-5 block h-56 animate-breathe rounded-card bg-ink/[0.14]" />
      <span
        aria-hidden
        className="mt-auto block h-[76px] animate-breathe rounded-button bg-clay-cta/40 max-sm:mt-6"
      />
    </RoomLoading>
  );
}
