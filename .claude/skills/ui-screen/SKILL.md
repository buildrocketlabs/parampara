---
name: ui-screen
description: Build or rework any Parampara screen to the design bar. Use for every page or component that a user sees.
---
# Building a screen
1. Read `docs/DESIGN.md` §Principles, §Tokens, §Signature components and the route's entry in §Screens. If the official `frontend-design` skill is installed, read it too; our DESIGN.md wins on conflicts.
2. Write the screen's one job in a comment at the top of the page file: *who, what one action, what feeling*.
3. Compose from `components/ui/` and `components/parampara/` first. New primitive? Add it to the `/design` gallery in the same change.
4. Tokens only (Tailwind theme from `app/globals.css`). No hex in components. No arbitrary values unless a comment says why.
5. Copy lives in `lib/i18n/kn.ts` and `lib/i18n/en.ts`; Kannada first, warm, short, spoken style (DESIGN §Voice and copy). No hyphens in copy.
6. Every state: loading (skeleton or LampLoader with honest stage), empty (Hanate + one action), error (Hanate *caring* + retry + text fallback), offline (OfflineBanner + cached content).
7. Motion from `lib/motion.ts` springs; `useReducedMotion()` fallbacks; nothing loops forever except Hanate idle breathing.
8. Touch ≥ 48px, primary 56px; body 18px teacher, 22px master; Kannada line height 1.65.
9. Screenshots at 390x844 and 1280x800 in kn and en: `pnpm e2e:shots <route>` → `docs/demos/<ticket>/`.
10. Ask the `design-critic` subagent. Fix until ≥ 8/10.
