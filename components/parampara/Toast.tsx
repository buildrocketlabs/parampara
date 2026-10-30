"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HeartHandshake, X } from "lucide-react";
import type { Text, Vars } from "@/lib/i18n/fill";
import { useLang } from "@/lib/i18n/provider";
import { idleModule } from "@/lib/idle-module";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { BiText } from "./BiText";

// Warm, bottom, polite (DESIGN §4). A short note on the chalkboard colour that leaves on its own,
// waits while a finger or focus is on it, and never steals focus. At most three at once.
export type ToastTone = "default" | "success" | "caring";

export type ToastInput = {
  text: Text;
  vars?: Vars;
  tone?: ToastTone;
  action?: { label: Text; onClick: () => void };
  /** Milliseconds on screen. Default 4500, or 8000 with an action; 0 keeps it until dismissed. */
  durationMs?: number;
};

type Item = ToastInput & { id: number };

type ToastApi = { toast: (input: ToastInput) => number; dismiss: (id: number) => void };

const Ctx = createContext<ToastApi | null>(null);
const MAX = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const toast = useCallback((input: ToastInput) => {
    const id = next.current++;
    setItems((all) => [...all, { ...input, id }].slice(-MAX));
    return id;
  }, []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Toaster items={items} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  const { say } = useLang();
  const api = useMemo(() => {
    if (!ctx) return null;
    const pair = (text: Text, vars?: Vars) => ({
      kn: say("kn", text, vars),
      en: say("en", text, vars),
    });
    return {
      dismiss: ctx.dismiss,
      // Words are looked up here, in the caller's area: the toasts render at the root, which holds
      // only the core strings (lib/i18n/areas.ts).
      toast: (input: ToastInput) =>
        ctx.toast({
          ...input,
          text: pair(input.text, input.vars),
          vars: undefined,
          action: input.action && { ...input.action, label: pair(input.action.label) },
        }),
    };
  }, [ctx, say]);
  if (!api)
    throw new Error(
      "useToast must be used inside <ToastProvider> (components/parampara/Providers)",
    );
  return api;
}

// Toasts rise in, wait, and slide to make room for each other with Motion (./ToastStack), loaded
// at idle (DESIGN §10). Before then a toast simply appears, in the same place and the same words.
const useStack = idleModule(() => import("./ToastStack"));

function Toaster({ items, dismiss }: { items: Item[]; dismiss: (id: number) => void }) {
  const { t } = useLang();
  // Mounted with the first toast and kept, so the last one still animates out.
  const [shown, setShown] = useState(false);
  if (items.length > 0 && !shown) setShown(true);
  // Sit above the offline banner when it is showing.
  const online = useOnline();
  const stack = useStack();

  return (
    <section
      aria-label={t("toast.region")}
      data-toasts
      className={cn(
        "pointer-events-none fixed inset-x-4 z-[60] mx-auto flex max-w-md flex-col gap-2",
        online ? "bottom-[max(1rem,env(safe-area-inset-bottom))]" : "bottom-28",
      )}
    >
      <ol aria-live="polite" className="flex flex-col gap-2">
        {shown &&
          (stack ? (
            <stack.ToastStack items={items} dismiss={dismiss} />
          ) : (
            items.map((item) => (
              <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
            ))
          ))}
      </ol>
    </section>
  );
}

export type ToastLi = (props: React.LiHTMLAttributes<HTMLLIElement>) => React.ReactNode;
const PlainLi: ToastLi = (props) => <li {...props} />;

export function ToastCard({
  item,
  onDismiss,
  Li = PlainLi,
}: {
  item: ToastInput;
  onDismiss: () => void;
  /** Motion's animated list item (ToastStack), or a plain one. */
  Li?: ToastLi;
}) {
  const { t } = useLang();
  const [held, setHeld] = useState(false);
  const duration = item.durationMs ?? (item.action ? 8000 : 4500);
  // The latest dismiss handler, so a parent re-render never restarts the timer.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (held || duration === 0) return;
    const id = window.setTimeout(() => dismissRef.current(), duration);
    return () => window.clearTimeout(id);
  }, [held, duration]);

  const tone = item.tone ?? "default";

  return (
    <Li
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      className="pointer-events-auto flex min-h-16 items-start gap-3 rounded-card bg-ink-2 py-2 pr-2 pl-3 text-white shadow-warm-lg"
    >
      <span
        aria-hidden
        className="mt-1.5 grid size-10 shrink-0 place-items-center rounded-chip bg-ink"
      >
        {tone === "caring" ? (
          <HeartHandshake className="size-5 text-clay-glow" />
        ) : (
          <svg viewBox="0 0 12 16" className={cn("h-5 w-4", tone === "success" && "scale-110")}>
            <path
              d="M6 0 C8 4 11 6.5 11 10 C11 13.5 8.8 16 6 16 C3.2 16 1 13.5 1 10 C1 6.5 4 4 6 0 Z"
              fill="var(--color-flame)"
            />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1 py-1.5">
        <p className="text-[16px] leading-snug font-medium">
          <BiText
            text={item.text}
            vars={item.vars}
            subClassName="text-[14px] font-normal text-mist"
          />
        </p>
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss();
            }}
            className="-ml-2 h-12 rounded-button px-2 font-display text-[16px] font-bold text-flame hover:bg-ink"
          >
            <BiText text={item.action.label} sub={false} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("toast.dismiss")}
        className="grid size-12 shrink-0 place-items-center rounded-button text-mist hover:bg-ink hover:text-white"
      >
        <X className="size-5" aria-hidden />
      </button>
    </Li>
  );
}
