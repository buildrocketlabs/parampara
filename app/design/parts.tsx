import { Bi } from "@/components/parampara/Bi";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Gallery scaffolding: a section per component and a specimen card per state.
export function Section({
  id,
  name,
  file,
  desc,
  children,
  className,
}: {
  id: string;
  name: string;
  file: string;
  desc: MessageKey;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-gallery-section={id}
      className="scroll-mt-28 border-t border-border py-10 first:border-t-0 sm:py-14"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          id={`${id}-title`}
          className="text-[28px] leading-tight font-bold text-ink sm:text-[32px]"
        >
          {name}
        </h2>
        <code className="font-mono text-[13px] text-ink-3">
          {file.startsWith("components/") ? file : `components/parampara/${file}`}
        </code>
      </div>
      <p className="mt-2 max-w-2xl text-lg text-ink-3">
        <Bi k={desc} subClassName="text-[15px]" />
      </p>
      <div className={cn("mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3", className)}>
        {children}
      </div>
    </section>
  );
}

export function Specimen({
  label,
  children,
  className,
  surface = "paper",
}: {
  /** The state shown, as a short code name (idle, loading, error…). */
  label: string;
  children: React.ReactNode;
  className?: string;
  surface?: "paper" | "dusk" | "cream" | "ink";
}) {
  return (
    <figure
      className={cn(
        "flex min-w-0 flex-col rounded-card border border-border p-3 shadow-warm-sm sm:p-5",
        surface === "paper" && "bg-paper",
        surface === "cream" && "bg-cream",
        surface === "dusk" && "bg-dusk-gradient",
        surface === "ink" && "border-ink bg-ink",
        className,
      )}
    >
      <figcaption
        className={cn(
          "mb-4 flex items-center gap-2 px-2 pt-2 font-mono text-[14px] font-medium sm:px-0 sm:pt-0",
          surface === "ink" ? "text-mist" : "text-ink-3",
        )}
      >
        <span
          aria-hidden
          className={cn("size-1.5 rounded-chip", surface === "ink" ? "bg-clay-glow" : "bg-clay")}
        />
        {label}
      </figcaption>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </figure>
  );
}
