import Link from "next/link";

// Small static diya + name. Kannada name leads in both languages; it is the product's name.
// Inside a room it leads to that room's home, not back to the landing page.
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-2.5 rounded-button pr-2"
      aria-label="ಪರಂಪರೆ Parampara, home"
    >
      <svg viewBox="0 0 40 44" className="h-9 w-8" aria-hidden>
        <path
          d="M20 2 C23 8 27 12 27 17 C27 21.5 24 24 20 24 C16 24 13 21.5 13 17 C13 12 17 8 20 2 Z"
          fill="var(--color-flame)"
        />
        <path
          d="M20 13 C21.4 16 23 18 23 20 C23 22 21.6 23 20 23 C18.4 23 17 22 17 20 C17 18 18.6 16 20 13 Z"
          fill="var(--color-paper)"
        />
        <path d="M4 27 C4 37 11 42 20 42 C29 42 36 37 36 27 Z" fill="var(--color-clay)" />
        <ellipse cx="20" cy="27" rx="16" ry="3.6" fill="var(--color-clay-cta)" />
      </svg>
      <span className="flex flex-col leading-none">
        <span lang="kn" className="font-display text-[22px] font-bold leading-none text-clay">
          ಪರಂಪರೆ
        </span>
        <span className="mt-0.5 font-display text-sm font-semibold tracking-wide text-ink-3">
          Parampara
        </span>
      </span>
    </Link>
  );
}
