"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Hand } from "lucide-react";
import * as mo from "motion/react-m";
import { FieldBadge, SampleBadge } from "@/components/parampara/Badges";
import { Bi } from "@/components/parampara/Bi";
import { BiText } from "@/components/parampara/BiText";
import { BottomSheet } from "@/components/parampara/BottomSheet";
import { EmptyState } from "@/components/parampara/EmptyState";
import { Hanate } from "@/components/parampara/hanate/Hanate";
import { MasterMedallion } from "@/components/parampara/MasterMedallion";
import type { Bilingual } from "@/lib/domain/fln";
import { useLang } from "@/lib/i18n/provider";
import {
  DISTRICTS,
  districtName,
  MAP_H,
  MAP_W,
  TILE_H,
  TILE_W,
  tileCentre,
  type District,
} from "@/lib/insights/districts";
import { springs } from "@/lib/motion";
import type { Count, LampDistrict } from "@/lib/insights/types";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";
import { LampGlyph } from "./LampGlyph";
import { MotionIsland } from "@/components/parampara/MotionIsland";

// Lamps of Karnataka (docs/BUILD.md M5.2): the 31 districts as hex tiles on the chalkboard. Each
// lit lamp is real use of the masters' wisdom (5 or more teachers there said an idea worked), its
// size following the count. Tap a district for whose practice helped there, never who was helped.
// Smaller districts are never named: they share one "elsewhere" row (0006). Lamps light once,
// north to south, then hold still; under reduced motion they are simply lit.

type Selected = { key: string | null; name: Bilingual; lamp: LampDistrict | null };

const ELSEWHERE = "elsewhere";

/** 0.55 to 1 of a full lamp, by the square root of the count, so area follows the number. */
function lampScale(c: Count, max: number): number {
  if (c.hidden || max <= 0) return 0.55;
  return 0.55 + 0.45 * Math.sqrt(c.n / max);
}

const isLit = (l: LampDistrict | undefined | null) =>
  Boolean(l && (l.helped.hidden || l.helped.n > 0));

function HexShape({ lit, selected }: { lit: boolean; selected: boolean }) {
  const r = TILE_H / 2 - 3;
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(TILE_W / 2 + r * Math.cos(a)).toFixed(1)},${(TILE_H / 2 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${TILE_W} ${TILE_H.toFixed(1)}`}
      className="absolute inset-0 size-full overflow-visible"
    >
      <polygon
        points={points}
        strokeLinejoin="round"
        className={cn(
          "pointer-events-auto",
          "transition-[fill,stroke,stroke-width] duration-200 group-focus-visible:stroke-white group-focus-visible:[stroke-width:6]",
          selected
            ? "fill-flame/30 stroke-white [stroke-width:5]"
            : lit
              ? "fill-flame/20 stroke-flame [stroke-width:3] group-hover:fill-flame/30"
              : "fill-ink-2 stroke-mist/40 [stroke-width:2] group-hover:fill-ink-3",
        )}
      />
    </svg>
  );
}

function Tile({
  d,
  lamp,
  max,
  order,
  selected,
  onOpen,
}: {
  d: District;
  lamp: LampDistrict | undefined;
  max: number;
  order: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const { t } = useLang();
  const reduced = usePrefersReducedMotion();
  const { x, y } = tileCentre(d);
  const lit = isLit(lamp);
  const words = lamp
    ? lamp.helped.hidden
      ? t("pulse.fewer")
      : String(lamp.helped.n)
    : t("lamps.legend.unlit");
  const scale = lamp ? lampScale(lamp.helped, max) : 0.55;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-district={d.key}
      data-lit={lit || undefined}
      // Unlit tiles stay tappable but out of the tab order: the list beside the map is the
      // keyboard way to every lit district.
      tabIndex={lit ? 0 : -1}
      aria-label={`${d.name.kn} · ${d.name.en}: ${words}`}
      // The hexagon is the target (pointer events on its shape only), so a district's name may
      // reach past its tile without being cut off or catching a neighbour's tap.
      className="group pointer-events-none absolute flex flex-col items-center justify-center outline-none"
      style={{
        left: `${((x - TILE_W / 2) / MAP_W) * 100}%`,
        top: `${((y - TILE_H / 2) / MAP_H) * 100}%`,
        width: `${(TILE_W / MAP_W) * 100}%`,
        height: `${(TILE_H / MAP_H) * 100}%`,
      }}
    >
      <HexShape lit={lit} selected={selected} />
      {lit && lamp ? (
        <mo.span
          className="relative flex flex-col items-center"
          style={{ originY: 1 }}
          initial={reduced ? false : { scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ ...springs.gentle, delay: 0.25 + order * 0.14 }}
          data-lamp-lit
        >
          <LampGlyph
            lit
            className="h-auto drop-shadow-[0_0_14px_rgb(255_201_77/0.55)]"
            size={44}
            style={{ width: `calc(var(--lamp) * ${scale.toFixed(3)})` }}
          />
          {!lamp.helped.hidden && (
            <span className="mt-0.5 rounded-chip bg-flame px-1.5 font-display text-[14px] leading-5 font-bold text-ink tabular-nums">
              {lamp.helped.n}
            </span>
          )}
        </mo.span>
      ) : (
        <span aria-hidden className="relative block size-1.5 rounded-full bg-mist/40" />
      )}
      <span
        aria-hidden
        className={cn(
          "relative z-10 mt-1 block px-0.5 text-center font-display text-[14px] leading-[1.1] font-semibold text-balance [text-shadow:0_0_3px_var(--color-ink),0_0_6px_var(--color-ink)]",
          lit ? "text-white" : "text-mist",
        )}
      >
        <span data-lang-mode="kn" lang="kn">
          {d.name.kn}
        </span>
        <span data-lang-mode="en" lang="en">
          {breakable(d.name.en)}
        </span>
      </span>
    </button>
  );
}

/** Soft hyphens in the longest English names, so they break inside their tile, not across it. */
const SOFT: Record<string, string> = {
  Chamarajanagar: "Chamaraja\u00adnagar",
  Chikkamagaluru: "Chikka\u00admagaluru",
  Chikkaballapur: "Chikka\u00adballapur",
};
function breakable(name: string): string {
  return SOFT[name] ?? name;
}

function LampsMapMoving({
  lamps,
  isSample,
  noFieldYet = false,
}: {
  lamps: LampDistrict[];
  isSample: boolean;
  /** Sample is shown because there is no field data yet: say so beside the badge. */
  noFieldYet?: boolean;
}) {
  const { t } = useLang();
  const [selected, setSelected] = useState<Selected | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Centre the whole lit cluster, so no lit district starts half hidden.
    const box = scroller.current;
    const lit = box ? [...box.querySelectorAll<HTMLElement>("[data-lit]")] : [];
    if (!box || lit.length === 0 || box.scrollWidth <= box.clientWidth) return;
    const origin = box.getBoundingClientRect().left - box.scrollLeft;
    const left = Math.min(...lit.map((el) => el.getBoundingClientRect().left - origin));
    const right = Math.max(...lit.map((el) => el.getBoundingClientRect().right - origin));
    box.scrollLeft = Math.max(0, (left + right) / 2 - box.clientWidth / 2);
  }, []);
  const byKey = useMemo(() => new Map(lamps.map((l) => [l.district ?? ELSEWHERE, l])), [lamps]);
  const onMap = lamps.filter((l) => DISTRICTS.some((d) => d.key === l.district));
  const max = Math.max(0, ...onMap.map((l) => (l.helped.hidden ? 0 : l.helped.n)));
  const litList = lamps
    .filter(isLit)
    .sort(
      (a, b) =>
        Number(a.district === ELSEWHERE) - Number(b.district === ELSEWHERE) ||
        (b.helped.n ?? 0) - (a.helped.n ?? 0),
    );
  const hasElsewhere = litList.some((l) => l.district === ELSEWHERE);
  // Lamps light from the north down, one after another (DESIGN §2.1).
  const litOrder = new Map(
    DISTRICTS.filter((d) => isLit(byKey.get(d.key))).map((d, i) => [d.key as string, i]),
  );

  const open = (key: string | null, lamp: LampDistrict | null) =>
    setSelected({ key, name: districtName(key), lamp });
  const Badge = isSample ? SampleBadge : FieldBadge;

  return (
    // A laptop sees the map with the list riding beside it. A phone sees the map first, every
    // district named, sliding sideways in its frame (the faded edge says there is more).
    <div className="grid gap-6 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <figure className="min-w-0 rounded-card bg-ink p-3 shadow-warm-lg sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-2">
          <Badge onDark />
          {noFieldYet && (
            <span data-notice="no-field" className="text-[14px] text-mist">
              <Bi k="lamps.noField" sub={false} />
            </span>
          )}
          <span
            data-primary
            className="ml-auto inline-flex items-center gap-1.5 text-[14px] text-mist"
          >
            <Hand className="size-4" aria-hidden />
            <span className="lg:hidden">
              <Bi k="lamps.tap.phone" sub={false} />
            </span>
            <span className="hidden lg:inline">
              <Bi k="lamps.tap" sub={false} />
            </span>
          </span>
        </div>
        {/* On a phone the map keeps a readable size with every name on it, and scrolls sideways
            inside its frame, starting at the lit districts. */}
        <div
          ref={scroller}
          className="max-lg:-mx-1 max-lg:overflow-x-auto max-lg:[mask-image:linear-gradient(to_right,black_88%,transparent)] max-lg:px-1 max-lg:pb-1"
        >
          <div
            role="group"
            aria-label={t("lamps.map.label")}
            className="relative mx-auto w-full max-w-[720px] [--lamp:32px] max-lg:min-w-[560px] lg:max-w-[580px] lg:[--lamp:clamp(28px,2.4vw,36px)]"
            style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
          >
            {DISTRICTS.map((d) => (
              <Tile
                key={d.key}
                d={d}
                lamp={byKey.get(d.key)}
                max={max}
                order={litOrder.get(d.key) ?? 0}
                selected={selected?.key === d.key}
                onOpen={() => open(d.key, byKey.get(d.key) ?? null)}
              />
            ))}
          </div>
        </div>
        <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-1 text-[14px] text-mist">
          <span className="inline-flex items-center gap-1.5">
            <LampGlyph lit size={22} />
            <Bi k="lamps.legend.size" sub={false} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-3.5 rotate-30 rounded-[3px] border border-ink-3 bg-ink-2"
            />
            <Bi k="lamps.legend.unlit" sub={false} />
          </span>
          <span className="basis-full text-center text-[15px] text-white">
            <Bi k="lamps.sub" sub={false} />
          </span>
          <span className="basis-full text-center">
            <Bi k="lamps.legend.shape" sub={false} />
          </span>
        </figcaption>
      </figure>

      <section
        aria-labelledby="lit-title"
        className="min-w-0 rounded-card border border-border bg-paper p-5 shadow-warm-sm sm:p-6 lg:sticky lg:top-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lit-title" className="text-[22px] leading-tight font-bold">
            <Bi k="lamps.list.title" subClassName="font-sans text-[15px] font-semibold" />
          </h2>
          <Badge />
        </div>
        {litList.length === 0 ? (
          <EmptyState
            hanate="resting"
            title="lamps.empty.title"
            body={isSample ? "lamps.empty.body" : "lamps.empty.field"}
            className="mt-2"
          />
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {litList.map((l) => {
              const elsewhere = l.district === ELSEWHERE;
              return (
                <li key={l.district ?? ELSEWHERE}>
                  <button
                    type="button"
                    data-lamp-row={l.district}
                    onClick={() => open(l.district, l)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-[16px] py-3 text-left outline-none hover:bg-cream focus-visible:ring-2 focus-visible:ring-clay"
                  >
                    <span className="flex w-10 shrink-0 justify-center">
                      <LampGlyph
                        lit
                        scale={elsewhere ? 0.55 : lampScale(l.helped, max)}
                        size={34}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[18px] leading-tight font-bold text-ink">
                        <BiText text={districtName(l.district)} sub={false} />
                      </span>
                      <span className="mt-0.5 block text-[15px] text-ink-3">
                        {l.helped.hidden ? (
                          <Bi k="lamps.helpedFew" sub={false} />
                        ) : (
                          <BiText text="lamps.helped" vars={{ n: l.helped.n }} sub={false} />
                        )}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasElsewhere && (
          <p className="mt-4 text-[14px] text-ink-3">
            <Bi k="lamps.elsewhere.note" sub={false} />
          </p>
        )}
        <p className="mt-3 text-[14px] text-ink-3">
          <Bi k="lamps.sheet.private" sub={false} />
        </p>
      </section>

      <BottomSheet
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.name ?? "lamps.title"}
        badge={<Badge />}
      >
        {selected && <DistrictSheet lamp={selected.lamp} max={max} />}
      </BottomSheet>
    </div>
  );
}

function SheetLamp({ scale }: { scale: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <mo.span
      className="flex"
      style={{ originY: 1 }}
      initial={reduced ? false : { scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ ...springs.gentle, delay: 0.15 }}
    >
      <LampGlyph lit scale={scale} size={56} />
    </mo.span>
  );
}

function DistrictSheet({ lamp, max }: { lamp: LampDistrict | null; max: number }) {
  if (!lamp || !isLit(lamp)) {
    return (
      <div className="flex flex-col items-center py-4 text-center" data-sheet="unlit">
        <Hanate state="caring" size={96} label="" />
        <p className="mt-4 max-w-sm text-[17px] text-ink-3">
          <Bi k="lamps.sheet.none" subClassName="text-[15px]" />
        </p>
      </div>
    );
  }
  // Masters in name order, not by count: the sheet thanks them, it does not rank them.
  const masters = [...lamp.masters].sort((a, b) => (a.name ?? "~").localeCompare(b.name ?? "~"));
  return (
    <div data-sheet="lit">
      <div className="flex items-center gap-4 rounded-[22px] bg-flame/20 p-4">
        <SheetLamp scale={lampScale(lamp.helped, max)} />
        <p className="font-display text-[22px] leading-tight font-bold text-ink">
          {lamp.helped.hidden ? (
            <Bi k="lamps.helpedFew" subClassName="font-sans text-[15px] font-semibold" />
          ) : (
            <BiText
              text="lamps.helped"
              vars={{ n: lamp.helped.n }}
              subClassName="font-sans text-[15px] font-semibold"
            />
          )}
        </p>
      </div>
      <h3 className="mt-6 text-[18px] font-bold">
        <Bi k="lamps.sheet.masters" subClassName="font-sans text-[14px] font-semibold" />
      </h3>
      <ul className="mt-3 space-y-3">
        {masters.map((m, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-[20px] border border-border bg-paper p-3"
          >
            <MasterMedallion name={m.name} size="sm" portraitOnly />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[18px] leading-tight font-bold text-ink">
                {m.name ?? <Bi k="master.anonymous" sub={false} />}
              </span>
              {m.years ? (
                <span className="block text-[14px] text-ink-3">
                  <BiText text="master.years" vars={{ n: m.years }} sub={false} />
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-right font-display text-[16px] font-bold text-ink">
              {m.helped.hidden ? (
                <Bi
                  k={m.helped.shield ? "pulse.shield" : "pulse.fewer.cap"}
                  sub={false}
                  className="text-[14px] text-ink-3"
                />
              ) : (
                <BiText text="lamps.helped" vars={{ n: m.helped.n }} sub={false} />
              )}
            </span>
          </li>
        ))}
      </ul>
      {lamp.masters.some((m) => m.helped.hidden && m.helped.shield) && (
        <p className="mt-4 text-[14px] text-ink-3">
          <Bi k="pulse.shield.note" sub={false} />
        </p>
      )}
      {lamp.district === ELSEWHERE && (
        <p className="mt-4 text-[14px] text-ink-3">
          <Bi k="lamps.elsewhere.note" sub={false} />
        </p>
      )}
      <p className="mt-3 text-[14px] text-ink-3">
        <Bi k="lamps.sheet.private" sub={false} />
      </p>
    </div>
  );
}

/** LampsMap, inside its own Motion island (components/parampara/MotionIsland). */
export function LampsMap(props: React.ComponentProps<typeof LampsMapMoving>) {
  return (
    <MotionIsland>
      <LampsMapMoving {...props} />
    </MotionIsland>
  );
}
