"use client";

import { fill, nameIn, type Name } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { initialOf } from "@/lib/names";
import { cn } from "@/lib/utils";
import { IllustrationBadge, SampleBadge } from "./Badges";
import { BiText } from "./BiText";

// Whose wisdom it is (DESIGN §4): a circular portrait in a clay ring with a tiny flame on top.
// The portrait is an illustration made from a consented photo; without one, the master's initial
// sits on a warm field. Never a stock photo. `name: null` means the master chose to stay anonymous.
export type MasterMedallionProps = {
  /** A plain string, or a {kn, en} pair so a Kannada reader sees the name in Kannada. */
  name: Name | null;
  years?: number | null;
  /** A plain string, or a {kn, en} pair so a Kannada line stays in Kannada. */
  district?: string | { kn: string; en: string } | null;
  /** An illustrated portrait (never a photo). Shown with an Illustration label at lg. */
  portraitSrc?: string;
  size: "sm" | "md" | "lg";
  isSample?: boolean;
  /** Portrait only, for tight rows. The name is still the accessible label. */
  portraitOnly?: boolean;
  /** Show the Sample and Illustration labels here. Off when the parent shows them in its own row. */
  badges?: boolean;
  className?: string;
};

const RING = { sm: "size-10 p-[2px]", md: "size-16 p-[3px]", lg: "size-28 p-1" } as const;
// The small initial is 19 px bold, large text by WCAG, so clay on cream passes (at 17 px it did not).
const INITIAL = { sm: "text-[19px]", md: "text-[28px]", lg: "text-[50px]" } as const;
const FLAME = { sm: "h-3 w-2.5 -top-2", md: "h-4 w-3 -top-2.5", lg: "h-6 w-4.5 -top-4" } as const;

export function MasterMedallion({
  name,
  years,
  district,
  portraitSrc,
  size,
  isSample = false,
  portraitOnly = false,
  badges = true,
  className,
}: MasterMedallionProps) {
  const { msg } = useLang();
  const lg = size === "lg";
  const label = name
    ? `${fill(msg("kn", "master.portrait"), { name: nameIn(name, "kn") })} · ${fill(msg("en", "master.portrait"), { name: nameIn(name, "en") })}`
    : `${msg("kn", "master.anonymous")} · ${msg("en", "master.anonymous")}`;

  const portrait = (
    <span
      className={cn("relative inline-block shrink-0 rounded-chip bg-clay shadow-warm", RING[size])}
    >
      <span className="grid size-full place-items-center overflow-hidden rounded-chip bg-dusk ring-2 ring-paper">
        {portraitSrc ? (
          // Portraits come from signed Storage URLs; next/image would need every host configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitSrc}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : name ? (
          <span
            aria-hidden
            className={cn("font-display leading-none font-extrabold text-clay-cta", INITIAL[size])}
          >
            {typeof name === "string" ? (
              initialOf(name)
            ) : (
              <>
                <span data-lang-mode="kn">{initialOf(name.kn)}</span>
                <span data-lang-mode="en">{initialOf(name.en)}</span>
              </>
            )}
          </span>
        ) : (
          <AnonymousLamp size={size} />
        )}
      </span>
      <svg
        viewBox="0 0 12 16"
        aria-hidden
        className={cn(
          "absolute left-1/2 -translate-x-1/2 drop-shadow-[0_0_6px_var(--color-flame)]",
          FLAME[size],
        )}
      >
        <path
          d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
          fill="var(--color-flame)"
        />
        <path
          d="M6 7 C7 9 8.2 10.4 8.2 12 C8.2 13.6 7.2 14.8 6 14.8 C4.8 14.8 3.8 13.6 3.8 12 C3.8 10.4 5 9 6 7 Z"
          fill="var(--color-paper)"
          opacity="0.85"
        />
      </svg>
    </span>
  );

  if (portraitOnly) {
    return (
      <span role="img" aria-label={label} className={cn("inline-flex", className)}>
        {portrait}
      </span>
    );
  }

  const meta = [
    years ? <BiText key="y" text="master.years" vars={{ n: years }} sub={false} inline /> : null,
    district ? (
      typeof district === "string" ? (
        <span key="d">{district}</span>
      ) : (
        <BiText key="d" text={district} sub={false} inline />
      )
    ) : null,
  ].filter(Boolean);

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex min-w-0",
        lg ? "flex-col items-center text-center" : "items-center gap-3",
        size === "sm" && "gap-2.5",
        className,
      )}
    >
      {portrait}
      <div className={cn("min-w-0", lg && "mt-4")}>
        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", lg && "justify-center")}>
          <p
            className={cn(
              "font-display leading-tight font-bold text-ink",
              size === "sm" && "text-[16px]",
              size === "md" && "text-[19px]",
              lg && "text-[26px]",
            )}
          >
            {name === null ? (
              <BiText text="master.anonymous" sub={false} inline />
            ) : typeof name === "string" ? (
              name
            ) : (
              <BiText text={name} sub={false} inline />
            )}
          </p>
          {badges && isSample && size === "sm" && <SampleBadge />}
        </div>
        {meta.length > 0 && size !== "sm" && (
          <p className={cn("mt-0.5 text-ink-3", lg ? "text-[16px]" : "text-[15px]")}>
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden> · </span>}
                {m}
              </span>
            ))}
          </p>
        )}
        {badges && size === "md" && (isSample || portraitSrc) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {isSample && <SampleBadge />}
            {portraitSrc && <IllustrationBadge />}
          </div>
        )}
        {badges && lg && (isSample || portraitSrc) && (
          <div className="mt-3 flex justify-center gap-2">
            {isSample && <SampleBadge />}
            {portraitSrc && <IllustrationBadge />}
          </div>
        )}
      </div>
    </div>
  );
}

// The anonymous master: a small lamp in place of a face or an initial.
function AnonymousLamp({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <svg
      viewBox="0 0 40 30"
      aria-hidden
      className={cn(size === "sm" ? "w-6" : size === "md" ? "w-9" : "w-16")}
    >
      <path d="M4 10 C4 21 11 27 20 27 C29 27 36 21 36 10 Z" fill="var(--color-clay)" />
      <ellipse cx="20" cy="10" rx="16" ry="3.6" fill="var(--color-clay-cta)" />
      <path d="M20 8 L20 3" stroke="var(--color-ink-2)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
