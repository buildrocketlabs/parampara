---
name: mascot-and-motion
description: Animate Hanate the lamp mascot and add micro interactions, celebrations and haptics. Use when adding or changing any animation.
---
# Hanate and motion
- Hanate lives in `components/parampara/hanate/`. One SVG, parts as separate groups (`body`, `rim`, `flame-outer`, `flame-inner`, `eyes`, `cheeks`, `glow`). State is a prop: `idle | listening | thinking | speaking | happy | caring | resting | celebrating` (DESIGN §Hanate states). The flame carries the emotion; the clay body only squashes and stretches.
- Variants live in `hanate/variants.ts`; each state ≤ 3 animated properties. Flame flicker uses a seeded noise path morph, not random jitter, so it looks alive but calm.
- `speaking` syncs flame scale to the audio's amplitude (Web Audio analyser in `VoicePlayer`), throttled to 30 fps.
- Springs: `snappy` (500/30) for taps, `gentle` (170/22) for sheets and cards, `bouncy` (300/14) for celebrations only. Durations: micro 120ms, small 200ms, medium 320ms, large 480ms.
- ChunkyButton press: translateY 4px into its lip, 60ms, plus `navigator.vibrate?.(8)` on Android.
- Celebration: row of lamps lights left to right (60ms stagger), then 12 to 18 marigold petals fall with slight rotation; sound optional and off by default; total under 1.6s; skippable by tap.
- Reduced motion: replace movement with opacity and colour change; Hanate holds a static pose per state.
- Performance: transform and opacity only; no layout animation in lists over 20 items; check 60 fps on a throttled mid range Android profile in Playwright.
- Add every new animation to the `/design` gallery with a replay button.
