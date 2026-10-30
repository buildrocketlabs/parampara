import { RoomLoading } from "@/components/parampara/RoomLoading";
import { SkeletonCard, SkeletonLine } from "@/components/parampara/Skeleton";

// How it works, while it opens: the site header, the title, the live numbers, then the six
// layers in two columns (DESIGN §2.7). Every number on the page is computed, so the skeleton
// holds their places and shows none.
export default function Loading() {
  return (
    <RoomLoading line="loading.how" chrome="site">
      <SkeletonLine width="60%" className="mt-4 h-10" />
      <SkeletonLine width="85%" className="mt-4 h-5" />
      <SkeletonLine width="60%" className="mt-2 h-5" />
      <SkeletonCard className="mt-8" lines={3} />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className="block h-40 animate-breathe rounded-card bg-paper shadow-warm-sm"
          />
        ))}
      </div>
    </RoomLoading>
  );
}
