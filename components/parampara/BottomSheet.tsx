"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, useDragControls, type PanInfo } from "motion/react";
import { MotionIsland } from "./MotionIsland";
import * as m from "motion/react-m";
import type { Text } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";

// A sheet from below on phones and a side panel on desktop (DESIGN §4, Vaul style without the
// dependency). Drag the handle down to dismiss, Escape closes, focus stays inside while open and
// returns to the opener after, the page behind does not scroll.
export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: Text;
  description?: Text;
  children: React.ReactNode;
  /** Stays pinned at the bottom of the sheet (totals, a primary action). */
  footer?: React.ReactNode;
  /** `auto` is a bottom sheet under 768 px and a right panel from 768 px up. */
  side?: "bottom" | "right" | "auto";
  /** A small label under the title, for example a SampleBadge. */
  badge?: React.ReactNode;
  /** A control beside the badge, for example the language toggle (a modal hides the page's). */
  headerAction?: React.ReactNode;
  /** Paper by default; `notebook` draws ruled lines (TraceDrawer). */
  surface?: "paper" | "notebook";
  className?: string;
};

const DESKTOP = "(min-width: 768px)";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const noopSubscribe = () => () => undefined;

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  badge,
  headerAction,
  side = "auto",
  surface = "paper",
  className,
}: BottomSheetProps) {
  const { t } = useLang();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const right = side === "right" || (side === "auto" && wide);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drag = useDragControls();
  const titleId = useId();
  const descId = useId();

  const close = () => onOpenChange(false);

  // Remember the opener, lock page scroll, move focus in; undo all of it on close.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const id = window.requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      first?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = overflow;
      opener.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === panel.current)
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) close();
  };

  if (!mounted) return null;

  return createPortal(
    // Drag to dismiss needs Motion's drag feature: loaded with the sheet, never on first load.
    <MotionIsland features="max">
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70]" onKeyDown={onKeyDown}>
            <m.div
              aria-hidden
              className="absolute inset-0 bg-ink/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />
            <m.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              initial={right ? { x: "100%" } : { y: "100%" }}
              animate={right ? { x: 0 } : { y: 0 }}
              exit={right ? { x: "100%" } : { y: "100%" }}
              transition={springs.gentle}
              drag={right ? false : "y"}
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={onDragEnd}
              className={cn(
                "absolute flex flex-col shadow-warm-lg outline-none",
                surface === "notebook" ? "notebook" : "bg-paper",
                right
                  ? "inset-y-0 right-0 w-[min(35rem,100vw)] rounded-l-sheet"
                  : "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-sheet pb-[env(safe-area-inset-bottom)]",
                className,
              )}
            >
              <div
                className={cn(
                  "shrink-0 px-5 pt-3 sm:px-6",
                  // A notebook's ruled lines start under the header, never through the title.
                  surface === "notebook" &&
                    cn(
                      "border-b border-border/60 bg-paper pb-3",
                      right ? "rounded-tl-sheet" : "rounded-t-sheet",
                    ),
                  right && "pt-5",
                  !right && "cursor-grab touch-none active:cursor-grabbing",
                )}
                onPointerDown={(e) => {
                  if (!right) drag.start(e);
                }}
              >
                {!right && (
                  <span
                    aria-hidden
                    className="mx-auto mb-3 block h-1.5 w-11 rounded-chip bg-ink/20"
                    title={t("sheet.handle")}
                  />
                )}
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 pt-1">
                    <h2 id={titleId} className="text-[22px] leading-tight font-bold text-ink">
                      <BiText text={title} subClassName="font-sans text-[15px] font-semibold" />
                    </h2>
                    {description && (
                      <p
                        id={descId}
                        className={cn(
                          "mt-1 text-[15px] text-ink-3",
                          headerAction && "max-sm:hidden",
                        )}
                      >
                        <BiText text={description} sub={false} />
                      </p>
                    )}
                  </div>
                  {headerAction && <div className="hidden shrink-0 sm:block">{headerAction}</div>}
                  <button
                    type="button"
                    onClick={close}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={t("sheet.close")}
                    className="-mr-2 grid size-12 shrink-0 place-items-center rounded-chip text-ink-3 hover:bg-sage hover:text-ink"
                  >
                    <X className="size-6" aria-hidden />
                  </button>
                </div>
                {/* Full width under the title row, so on a phone the badge and the control share
                    one line and the sheet keeps its height for the content. */}
                {(badge || headerAction) && (
                  <div
                    className={cn(
                      "mt-2 flex flex-wrap items-center justify-between gap-2",
                      !badge && "sm:hidden",
                    )}
                  >
                    {badge}
                    {headerAction && <div className="sm:hidden">{headerAction}</div>}
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-6 sm:px-6">
                {children}
              </div>
              {footer && (
                <div className="shrink-0 border-t border-border bg-paper/95 px-5 py-3 sm:px-6">
                  {footer}
                </div>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </MotionIsland>,
    document.body,
  );
}
