# Network check (Law 9)

Run on 2026-10-27 against https://parampara-eta.vercel.app by `tests/e2e/network.spec.ts`
(Playwright project `network`, Chromium, a 390 × 844 phone, the Sample teacher, English).

Presets are Chrome DevTools' own (devtools-frontend `front_end/core/sdk/NetworkManager.ts`),
applied with CDP `Network.emulateNetworkConditions`:

| Preset | Latency | Download | Upload |
|---|---:|---:|---:|
| Slow 3G | 2000 ms | 50,000 B/s | 50,000 B/s |
| Fast 3G | 562.5 ms | 1,80,000 B/s | 84,375 B/s |

Cold: a fresh phone, nothing cached. Warm: the same phone after the service worker (D52) took
control, then a reload. Interactive: the load event has passed and the main thread first goes
idle (requestIdleCallback). Times are from the start of the navigation, or from the tap.
The page's throttle does not reach the service worker's own fetches, so the worker is
throttled too (its CDP target), or a warm page would arrive at full speed and flatter us.
The chip and the queued question are a sample question the site answers from its cache.
One run: a server cold start can move a single cold number by seconds between runs.
First contentful paint is the first words on screen, not a full load: a stopwatch on the whole
page lands between it and interactive. Answer speed on an ordinary network (fresh questions,
warm chips) is measured in `docs/evals/latency.md`; the chip times here add 3G transfer to it.

| Check | Preset | Mode | Result | Pass | Note |
|---|---|---|---:|:---:|---|
| / first contentful paint | Slow 3G | cold | 6.2 s | yes |  |
| / interactive | Slow 3G | cold | 14.6 s | yes |  |
| / first contentful paint | Slow 3G | warm | 2.7 s | yes | service worker in control, and throttled too |
| / interactive | Slow 3G | warm | 2.8 s | yes |  |
| /t first contentful paint | Slow 3G | cold | 6.2 s | yes |  |
| /t interactive | Slow 3G | cold | 13.3 s | yes |  |
| /t first contentful paint | Slow 3G | warm | 2.8 s | yes | service worker in control, and throttled too |
| /t interactive | Slow 3G | warm | 2.8 s | yes |  |
| warm chip tap to answer page | Slow 3G | warm | 6.7 s | yes |  |
| warm chip tap to first step readable | Slow 3G | warm | 6.8 s | yes |  |
| answer readable before any audio is fetched | Slow 3G | warm | yes | yes | voice is fetched only when tapped |
| / first contentful paint | Fast 3G | cold | 1.9 s | yes |  |
| / interactive | Fast 3G | cold | 4.2 s | yes |  |
| / first contentful paint | Fast 3G | warm | 0.8 s | yes | service worker in control, and throttled too |
| / interactive | Fast 3G | warm | 0.9 s | yes |  |
| /t first contentful paint | Fast 3G | cold | 1.9 s | yes |  |
| /t interactive | Fast 3G | cold | 3.9 s | yes |  |
| /t first contentful paint | Fast 3G | warm | 0.9 s | yes | service worker in control, and throttled too |
| /t interactive | Fast 3G | warm | 0.9 s | yes |  |
| warm chip tap to answer page | Fast 3G | warm | 2.6 s | yes |  |
| warm chip tap to first step readable | Fast 3G | warm | 2.6 s | yes |  |
| answer readable before any audio is fetched | Fast 3G | warm | yes | yes | voice is fetched only when tapped |
| a saved answer opens offline from /t/saved | offline | warm | yes | yes | Ready offline shown first |
| offline, Ask another on a saved answer opens the ask screen | offline | warm | yes | yes |  |
| a page never visited shows /offline | offline | warm | yes | yes |  |
| a typed question is queued offline with an honest message | offline | warm | yes | yes |  |
| the queued question sends on reconnect and its answer opens | offline | warm | yes, 1.7 s | yes |  |
| Show me says a photo needs the network | offline | warm | yes | yes |  |

## What failed

Nothing.

The offline "Show me" step did not finish in the two runs before this one: the ask screen's
wake up call left its reply unread, so the page never reached network idle (fixed in F-P1).

## Measured elsewhere, the same days

- **Answer speed, ordinary network** (`docs/evals/latency.md`, 27 Oct 21:51 UTC): fresh answer
  text p50 12.9 s, voice ready p50 13.5 s; warm sample chips about 0.8 s.
- **A jury walk, 28 Oct:** a cold home page load on Slow 3G timed at 9.3 s in the juror's own
  browser. Not the same moment as this table's 6.2 s first paint; it falls between first paint
  (6.2 s) and interactive (14.6 s), as a full load would.
