import { cn } from "@/lib/utils";

// Skeletons shaped like the content that is coming (DESIGN §4). They breathe softly and hold still
// under reduced motion. Decorative: put aria-busy on the region that is loading.
export function SkeletonLine({
  className,
  width = "100%",
}: {
  className?: string;
  width?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("block h-4 animate-breathe rounded-chip bg-ink/[0.12]", className)}
      style={{ width }}
    />
  );
}

export function SkeletonMedallion({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block shrink-0 animate-breathe rounded-chip bg-ink/[0.12] ring-4 ring-ink/[0.06]",
        size === "sm" && "size-10",
        size === "md" && "size-16",
        size === "lg" && "size-28",
        className,
      )}
    />
  );
}

/** The AnswerCard's outline: medallion and name, title, player bar, three steps. */
export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-card border border-border bg-paper p-5 shadow-warm-sm sm:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonMedallion />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="55%" />
          <SkeletonLine width="35%" className="h-3" />
        </div>
      </div>
      <SkeletonLine width="80%" className="mt-6 h-6" />
      <span aria-hidden className="mt-5 block h-16 animate-breathe rounded-button bg-ink/[0.09]" />
      <div className="mt-6 space-y-5">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex gap-3">
            <span className="block size-8 shrink-0 animate-breathe rounded-chip bg-flame/30" />
            <div className="flex-1 space-y-2 pt-1">
              <SkeletonLine width={i % 2 ? "88%" : "96%"} />
              <SkeletonLine width={i % 2 ? "60%" : "72%"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
