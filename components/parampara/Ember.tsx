import { cn } from "@/lib/utils";

// A small flickering flame for pending states: honest "working on it", never a spinner
// (DESIGN §2.7). Its flicker is the shared animate-ember (globals.css), so reduced motion stills it.
export function Ember({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 20" aria-hidden className={cn("size-5 shrink-0 overflow-visible", className)}>
      <path
        className="animate-ember [transform-box:fill-box] origin-bottom"
        d="M8 1 C10 5 13 8 13 12 C13 16 10.8 19 8 19 C5.2 19 3 16 3 12 C3 8 6 5 8 1 Z"
        fill="var(--color-flame)"
      />
      <path
        d="M8 9 C9 11 10.4 12.6 10.4 14.4 C10.4 16.2 9.3 17.4 8 17.4 C6.7 17.4 5.6 16.2 5.6 14.4 C5.6 12.6 7 11 8 9 Z"
        fill="var(--color-flame-deep)"
      />
    </svg>
  );
}
