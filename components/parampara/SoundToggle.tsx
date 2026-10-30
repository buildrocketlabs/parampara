"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useLang } from "@/lib/i18n/provider";
import { setMuted, useMuted } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";

// Sounds on or off (Celebration's bell). Its own module, so a page that shows the switch does not
// load the celebration itself on first paint (DESIGN §10).
export function SoundToggle({ className }: { className?: string }) {
  const { t } = useLang();
  const muted = useMuted();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      aria-label={t(muted ? "sound.off" : "sound.on")}
      onClick={() => setMuted(!muted)}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-chip border border-border bg-paper px-4 font-display text-[15px] font-semibold text-ink-3 hover:text-ink",
        className,
      )}
    >
      {muted ? (
        <VolumeX className="size-5" aria-hidden />
      ) : (
        <Volume2 className="size-5" aria-hidden />
      )}
      <BiText text={muted ? "sound.off" : "sound.on"} sub={false} inline />
    </button>
  );
}
