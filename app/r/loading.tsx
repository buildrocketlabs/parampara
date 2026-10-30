import { RoomLoading } from "@/components/parampara/RoomLoading";
import { SkeletonLine } from "@/components/parampara/Skeleton";

// The reviewer's room while it opens: the title, the next card to review (the room's big card),
// then the rest waiting beside it on a laptop (DESIGN §2.7). The pages below (cards, queue,
// invites) share this boundary, so the line speaks of what waits, not of one page.
export default function Loading() {
  return (
    <RoomLoading line="loading.reviewer" chrome="session">
      <SkeletonLine width="55%" className="mt-4 h-9" />
      <SkeletonLine width="85%" className="mt-4 h-5" />
      <SkeletonLine width="65%" className="mt-2 h-5" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <span aria-hidden className="block h-72 animate-breathe rounded-card bg-ink/[0.14]" />
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <span
              key={i}
              aria-hidden
              className="block h-24 animate-breathe rounded-card bg-paper shadow-warm-sm"
            />
          ))}
        </div>
      </div>
    </RoomLoading>
  );
}
