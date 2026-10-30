"use client";

import { FlaskConical, MapPin, Paintbrush } from "lucide-react";
import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Bi } from "./Bi";

// Truth in the UI (CLAUDE.md Law 7). Synthetic data says Sample, real field data says Koppal field
// test, generated images say Illustration. Small, calm, always legible (14 px minimum).
type BadgeProps = { className?: string; onDark?: boolean };

const BASE =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-chip px-2.5 font-display text-[14px] leading-none font-semibold whitespace-nowrap";

export function SampleBadge({ className, onDark = false }: BadgeProps) {
  const { msg } = useLang();
  return (
    <span
      data-badge="sample"
      title={`${msg("en", "badge.sample.hint")} · ${msg("kn", "badge.sample.hint")}`}
      className={cn(
        BASE,
        "border border-dashed",
        onDark ? "border-mist text-mist" : "border-ink-3/50 bg-paper text-ink-3",
        className,
      )}
    >
      <FlaskConical className="size-3.5" aria-hidden />
      <Bi k="badge.sample" sub={false} />
    </span>
  );
}

export function FieldBadge({ className, onDark = false }: BadgeProps) {
  return (
    <span
      data-badge="field"
      className={cn(BASE, onDark ? "bg-sage text-ink" : "bg-moss text-white", className)}
    >
      <MapPin className="size-3.5" aria-hidden />
      <Bi k="badge.field" sub={false} />
    </span>
  );
}

export function IllustrationBadge({ className, onDark = false }: BadgeProps) {
  return (
    <span
      data-badge="illustration"
      className={cn(BASE, onDark ? "bg-ink-2 text-mist" : "bg-cream text-ink-3", className)}
    >
      <Paintbrush className="size-3.5" aria-hidden />
      <Bi k="badge.illustration" sub={false} />
    </span>
  );
}
