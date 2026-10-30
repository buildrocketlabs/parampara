import { RoomLoading } from "@/components/parampara/RoomLoading";
import { SkeletonLine } from "@/components/parampara/Skeleton";

// The officer's Pulse while it opens: the title, the field or Sample choice, the week's note,
// then the boards, as the Pulse lays them out (DESIGN §2.7). Every number comes from the
// database, so the skeleton only holds their places; the Lamps map shares this boundary.
export default function Loading() {
  return (
    <RoomLoading line="loading.officer" chrome="session" surface="cream">
      <SkeletonLine width="45%" className="mt-4 h-9" />
      <SkeletonLine width="70%" className="mt-4 h-5" />
      <span
        aria-hidden
        className="mt-6 block h-12 w-72 max-w-full animate-breathe rounded-chip bg-paper shadow-warm-sm"
      />
      <span aria-hidden className="mt-6 block h-64 animate-breathe rounded-card bg-ink/[0.14]" />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className="block h-56 animate-breathe rounded-card bg-paper shadow-warm-sm"
          />
        ))}
      </div>
    </RoomLoading>
  );
}
