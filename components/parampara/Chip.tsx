"use client";

import { useRef } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { haptics, vibrate } from "@/lib/motion";
import type { Text, Vars } from "@/lib/i18n/fill";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";

// Choice chips (DESIGN §4): 48 px tall, pill shaped. Selected chips use the clay-cta fill with white
// text (5.37:1); never an opacity hover on clay-cta. Presses sink a little and buzz 10 ms on Android.
const CHIP =
  "inline-flex h-12 shrink-0 select-none items-center gap-2 rounded-chip border px-5 font-display text-[16px] leading-none font-semibold whitespace-nowrap transition-[translate,scale,background-color,border-color,color] duration-150 ease-gentle active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0";
const OFF =
  "border-border bg-paper text-ink shadow-warm-sm hover:-translate-y-px hover:border-clay/45";
const ON = "border-clay-cta bg-clay-cta text-white shadow-warm";

export type ChipProps = Omit<React.ComponentProps<"button">, "children"> & {
  text: Text;
  vars?: Vars;
  icon?: LucideIcon;
  /** Set for toggle chips (aria-pressed). Leave undefined for action chips, like sample questions. */
  selected?: boolean;
};

export function Chip({
  text,
  vars,
  icon: Icon,
  selected,
  className,
  onPointerDown,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={rest.role ? undefined : selected}
      data-selected={selected || undefined}
      className={cn(CHIP, selected ? ON : OFF, className)}
      onPointerDown={(e) => {
        vibrate(haptics.press);
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {selected ? <Check aria-hidden strokeWidth={3} /> : Icon && <Icon aria-hidden />}
      <BiText text={text} vars={vars} sub={false} inline />
    </button>
  );
}

/** A non interactive chip for lists such as materials ("10 sticks", "a rubber band"). */
export function ChipTag({
  text,
  vars,
  icon: Icon,
  className,
}: {
  text: Text;
  vars?: Vars;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-sage px-3.5 py-1 text-[15px] font-medium text-ink",
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-moss" aria-hidden />}
      <BiText text={text} vars={vars} sub={false} inline />
    </span>
  );
}

export type ChipOption = { value: string; text: Text; vars?: Vars; icon?: LucideIcon };

type ChipGroupBase = {
  /** Accessible name for the group, already in the reader's language. */
  label: string;
  options: readonly ChipOption[];
  className?: string;
};
type Single = { multiple?: false; value: string | null; onChange: (value: string) => void };
type Multi = { multiple: true; value: readonly string[]; onChange: (value: string[]) => void };
export type ChipGroupProps = ChipGroupBase & (Single | Multi);

/**
 * Single choice is a radio group (arrow keys move and choose, one tab stop); multiple choice is a
 * group of toggle chips. Chips wrap onto new lines on phones.
 */
export function ChipGroup(props: ChipGroupProps) {
  const { label, options, className } = props;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  if (props.multiple) {
    const chosen = new Set(props.value);
    return (
      <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2.5", className)}>
        {options.map((o) => (
          <Chip
            key={o.value}
            text={o.text}
            vars={o.vars}
            icon={o.icon}
            selected={chosen.has(o.value)}
            onClick={() =>
              props.onChange(
                chosen.has(o.value)
                  ? props.value.filter((v) => v !== o.value)
                  : [...props.value, o.value],
              )
            }
          />
        ))}
      </div>
    );
  }

  const { value, onChange } = props;
  const active = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2.5", className)}>
      {options.map((o, i) => (
        <Chip
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === active ? 0 : -1}
          text={o.text}
          vars={o.vars}
          icon={o.icon}
          selected={o.value === value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(i, 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(i, -1);
            }
          }}
        />
      ))}
    </div>
  );
}
