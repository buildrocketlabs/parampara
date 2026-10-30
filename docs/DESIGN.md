# DESIGN · The Parampara design system

> **Concept: "Deepotsava."** A warm storybook classroom at dusk, where one clay lamp lights another.
> **Duolingo's craft, a headmaster's dignity.** Every screen should feel crafted, alive and kind; never childish, never corporate.

UI is how jurors decide in the first 30 seconds whether to believe the rest. The base is our own WonderBump Studio system (storybook warmth, rounded display type, cream canvas, warm tinted shadows, paper grain, contrast tested tokens, disciplined motion), re-tuned for Kannada, voice and a lamp.

---

## 1. Who we design for
| Person | Context | Design consequence |
|---|---|---|
| **Deepa, 26**, teacher, first posting, Koppal | Good Android phone, tired at 9 pm, Kannada first, short on time, wary of being watched | Voice first, one big action per screen, answers she can use tomorrow, zero forms, private delight |
| **Mahesh sir, headmaster**, 32 years in government schools | Reading glasses, more at home with WhatsApp voice notes than apps, proud of his craft | 22 px+ text, one button, the app talks first, his name and voice honoured |
| **Reviewer** (master teacher panel, DIET faculty) | Laptop or tablet, careful, accountable | Evidence beside every claim, fast approve, nothing hidden |
| **Officer** (BRC, DIET, BEO) | Laptop, wants action not charts | "What to do this week" before any number, anonymous by design |
| **Juror and evaluator** | Laptop, about an hour, English, wants to be convinced and to break it | One tap roles, English toggle, sample questions, trace drawer, no dead ends |

## 2. Principles
1. **One lamp lights another.** The core motion metaphor everywhere: knowledge passes as a flame, and the giver's flame never dims.
2. **Voice is the front door.** The microphone is the hero of the teacher app; typing is the quiet alternative.
3. **One screen, one job, one big button.**
4. **Show the source.** Every answer shows whose wisdom it is. Trust is a design feature.
5. **Alive, not loud.** Every interaction gets a response within 100 ms (press, ripple, flicker); big moments get choreography; nothing moves without meaning.
6. **Kannada is designed for, not translated into.** Larger sizes, taller line height, no letter spacing, no all caps, no italics in Kannada.
7. **Every state is designed.** Loading tells the truth about what is happening; empty states invite; errors say what happened and what to do; offline is a mode, not a failure.
8. **Warm restraint.** Clay is an accent; cream, paper, sage and ink carry the surface. One flame of colour per section.
9. **Private delight, never surveillance.** Celebrate the teacher, never rank her.
10. **Thumb first.** Primary actions sit in the bottom third at 390 px, targets 48 px minimum (56 px for primary).

## 3. Tokens
### Colour (contrast verified on 17 Oct; pin them in a `brandContrast` unit test like WonderBump's)
| Token | Hex | Use | Verified contrast |
|---|---|---|---|
| `ink` | `#15302A` | Text, dark surfaces (the chalkboard) | 12.74:1 on cream |
| `ink-2` | `#21453C` | Cards on dark | |
| `ink-3` | `#2C574C` | Secondary dark, strong secondary text | 7.37:1 on cream |
| `cream` | `#F7F3EA` | Canvas | |
| `paper` | `#FFFDF8` | Cards, sheets | |
| `sage` | `#DFE9D5` | Soft panels, success tint | ink on it 11.26:1 |
| `moss` | `#3F6B57` | Success text, positive icons | 5.49:1 on cream |
| `muted` | `#5B6B64` | Secondary text (never lighter) | 5.08:1 on cream |
| `mist` | `#A9C4B8` | Secondary text on ink | 7.58:1 on ink |
| `clay` | `#C8553D` | Brand: logo, lamp body, large headings, icons | 3.93:1 on cream: **large text and icons only** |
| `clay-cta` | `#B5472F` | Fills behind white text (primary buttons, active chips); normal size clay text on cream | white on it 5.37:1; on cream 4.85:1 |
| `clay-glow` | `#E8866C` | Clay accents on ink | 5.41:1 on ink |
| `flame` | `#FFC94D` | Lamp flame, celebration, highlights | ink on it 9.22:1 |
| `flame-deep` | `#F2A93B` | Flame gradient core | |
**Rules.** White text sits only on `clay-cta`, `ink`, `ink-2`, `moss`. Never an opacity hover on `clay-cta` (it lightens below 4.5:1). Shadows are warm tinted (clay and flame), never grey. The safety state uses calm `ink` and `flame`, never alarm red.

### Time of day (subtle, teacher app only)
Morning and day: cream canvas. After 6 pm: a soft dusk gradient (`cream` to a warm `#F3E3D3`) and Hanate's flame glows a little brighter. It makes the 9 pm moment feel seen.

### Type
| Role | Font | Notes |
|---|---|---|
| Display (Kannada + Latin) | **Baloo Tamma 2**, 600 to 800 | Rounded, friendly, built for Kannada. Headlines, numbers, buttons |
| Body Latin | **Plus Jakarta Sans**, 400 to 700 | From WonderBump |
| Body Kannada | **Noto Sans Kannada**, 400 to 700 | Falls in per glyph via the font stack |
| Accent (English only) | **Caveat** | One emotional word per screen at most |
Load with `next/font/google` (verify family names in T0). Sizes: teacher body **18 px**, master body **22 px**, Kannada line height **1.65**, Latin 1.5, display 1.1. Minimum anywhere 14 px.

### Shape, depth, texture
Radii: card 28 px, sheet 32 px top, chip 999 px, button 18 px. Paper grain overlay at 4% (WonderBump's inline SVG). Shadows: `shadow-warm-sm`, `shadow-warm`, `shadow-warm-lg` tinted with clay and flame. Spacing on a 4 px grid; screen padding 20 px at 390 px.

## 4. Signature components
- **ChunkyButton.** Solid fill with a 4 px darker "lip" underneath (`box-shadow: 0 4px 0 <darker>`). On press it sinks 4 px and the lip disappears; spring back on release; 10 ms haptic on Android. Variants: clay (primary), ink, paper (secondary), ghost. Full width on phones.
- **MicOrb.** 104 px clay circle, white microphone. Idle: slow breathing glow ring. Pressed: rings ripple outward driven by live mic amplitude; Hanate's flame leans toward it. Press and hold to talk, or tap to start and tap to stop (both, because elderly users tap). Live Kannada transcript fades in under it word by word.
- **LampLoader.** The honest progress indicator. The master's lamp passes a flame along a dotted path to Hanate while the server streams real pipeline stages: *understanding your question → finding elders' experience → checking every step → preparing the voice*. Never a generic spinner.
- **AnswerCard.** A storybook page that unfolds: master medallion (illustrated portrait, name, years, district), the practice title, a voice player, then steps that appear one by one, each with a small illustration, a materials row (chips like *10 sticks, a rubber band*), and *why it works* in one line. Footer: *Hear Mahesh sir say it* (plays the original clip), Save, Try tomorrow, Ask a follow up, and a small link *How this answer was made*.
- **VoicePlayer.** Big play button, live waveform, speed 0.8x / 1x / 1.2x, a karaoke highlight of the sentence being spoken, English subtitle toggle.
- **MasterMedallion.** Circular illustrated portrait in a clay ring with a tiny flame. Used wherever wisdom is attributed.
- **PracticeCard (reviewer).** Fields on the left; on the right the transcript with every field's evidence highlighted in flame; clicking a highlight jumps the audio to that moment.
- **Celebration.** On *worked*: Hanate lights a row of small lamps (one per child in the class), marigold petals fall (our confetti), a soft bell chimes. Text: ನೀವು ಇಂದು ದೀಪ ಹಚ್ಚಿದ್ದೀರಿ · *You lit a lamp today.* Then: *Send Mahesh sir a thank you?* (voice note).
- **TraceDrawer.** *How this answer was made*: a vertical timeline styled like a teacher's notebook: what you said (transcript), what we understood (triage), cards we found, the draft, the grounding verdict per step (green tick or removed), the safety check, the voice. Model, latency, tokens and cost per step. This is our technical strength, made visible.
- **OfflineBanner.** A small ember with *No network. Your saved answers still work. Questions you ask now will be sent when you are back online.* Never a red error.
- **LanguageToggle.** ಕನ್ನಡ / English pill, top right, everywhere. English mode keeps Kannada visible as a smaller line.
- **BottomSheet** (Vaul style), **Toast** (warm, bottom), **Chips**, **ProgressDots**, **Skeletons** shaped like the content.

## 5. Hanate (ಹಣತೆ), the mascot
An original character: a small terracotta clay lamp with a round bowl body, two dark dot eyes and soft flame coloured cheeks on the bowl, and a teardrop flame on top. **The flame is the face's emotion**: it leans, flickers, grows, dims. Simple geometry so it animates in code. It must not resemble any existing mascot.

| State | Trigger | Animation | Line (kn · en) |
|---|---|---|---|
| idle | home | slow flicker, blink every 4 to 7 s, gentle float | ನಮಸ್ಕಾರ ಮೇಡಂ · Namaskara, madam |
| listening | mic active | flame leans toward the mic and sways with voice amplitude | ಹೇಳಿ, ಕೇಳುತ್ತಿದ್ದೇನೆ · Go on, I am listening |
| thinking | pipeline running | receives the flame from the master's lamp; small sparks | ಹಿರಿಯರ ಅನುಭವ ಹುಡುಕುತ್ತಿದ್ದೇನೆ · Finding elders' experience |
| speaking | answer audio | flame pulses with the voice | (none) |
| happy | worked, saved, approved | flame grows, sparkles, small hop | ಅದ್ಭುತ! · Wonderful! |
| caring | safety path or no card | calm, flame lowers, turns toward a human icon | ಇದನ್ನು ಹಿರಿಯರೊಂದಿಗೆ ಮಾತಾಡೋಣ · Let us ask an elder about this |
| resting | offline | tiny ember, slow breathing | ನೆಟ್‌ವರ್ಕ್ ಬಂದಾಗ ಕಳುಹಿಸುತ್ತೇನೆ · I will send it when the network is back |
| celebrating | worked, master impact | lights a row of lamps | ನೀವು ಇಂದು ದೀಪ ಹಚ್ಚಿದ್ದೀರಿ · You lit a lamp today |
Build it as an SVG React component driven by Motion variants (`state` prop), with every animation disabled under reduced motion (it then shows a still pose per state). Rive is a later upgrade, not a dependency.

## 6. Motion system
- Durations: tap 100 ms · small 180 ms · medium 280 ms · large 450 ms · story beats 700 to 1200 ms.
- Springs: `snappy {stiffness: 500, damping: 30}` for presses; `gentle {stiffness: 170, damping: 22}` for cards; `bouncy {stiffness: 300, damping: 14}` for celebrations only.
- Choreography: content enters top to bottom with 40 to 60 ms stagger; the primary button enters last.
- Transform and opacity only. 60 fps on a mid range Android. Pause looping animation when offscreen (WonderBump's pauser).
- `prefers-reduced-motion`: no loops, no parallax, instant state changes; content never waits on an animation.
- Sound: a soft bell on success, a gentle tick on record start and stop; one mute toggle; never sound on load. Haptics: `navigator.vibrate` 10 ms on press, `[20, 40, 20]` on success, Android only.

## 7. Illustration system
Flat storybook illustration with warm rounded outlines in `ink`, fills from the palette, subtle paper grain, no gradients except the flame. Subjects: classroom objects (slates, sticks, akshara cards, bundles, a blackboard), hands teaching, lamps. People appear from behind or the side, never children's faces in close up.
Master teachers appear as **illustrated portraits** created from a consented photo; the real photo stays private.
Generation (Higgsfield or similar), keep one template so everything matches:
`Flat storybook illustration, warm rounded ink outlines (#15302A), fills in terracotta #C8553D, cream #F7F3EA, sage #DFE9D5, flame yellow #FFC94D, subtle paper grain, soft shadows, Indian government primary school context, [SUBJECT], centred, plain cream background, no text, no logos.`
Every generated image is labelled *Illustration* where a viewer could mistake it for a photo.

## 8. Screens and their wow moment
| Route | Screen | The moment |
|---|---|---|
| `/` | Story landing for jurors | The hero: an old lamp lights Hanate, who lights a row of lamps while the line appears: ಒಂದು ದೀಪ ಇನ್ನೊಂದು ದೀಪ ಹಚ್ಚುತ್ತದೆ · *One lamp lights another.* Below: four role doors with one tap demo entry, live counts from the database, how it works in four beats |
| `/t` | Teacher home | Time aware greeting, Hanate, the MicOrb, *Did yesterday's idea work?* card, common problem chips, saved answers |
| `/t/ask` | Ask | MicOrb with amplitude rings and live Kannada transcript; confirm sheet *Did you mean…?* |
| `/t/a/[id]` | Answer | LampLoader to AnswerCard unfold; *Hear Mahesh sir say it* |
| `/t/tried/[id]` | Worked or not | Lamp row celebration and the thank you note |
| `/t/saved` | Offline library | Works in airplane mode |
| `/m` | Master home | *Your lamp has lit 41 teachers*: a gentle map of lamps across Koppal; thank you notes to play |
| `/m/consent` | Voice consent | He says the consent line; we show it back in big Kannada text |
| `/m/talk` | Interview | One question at a time, huge text, Hanate asks aloud, tap to answer, stories collected as chapters |
| `/r` | Reviewer | Draft cards with evidence highlights and audio jumps; approve in one press |
| `/i` | Officer insights | *This week in Koppal*: what teachers asked, what worked, gaps to record next; anonymous; funnel asked, tried, worked |
| `/how` | How Parampara thinks | The six AI layers with a live example trace, the evals table, costs. For jurors |
Every screen: designed loading, empty, error, offline; phone pass at 390 px; desktop composition at 1280 px (teacher and master apps sit in a centred phone frame on desktop, with the story beside them).

## 9. Voice and copy
Kannada first, everyday register (as a headmaster speaks to a younger colleague), respectful: ಮೇಡಂ, ಸರ್, ನೀವು. Short sentences. English for jurors: warm, plain, no jargon, no em dashes. Name the master in every answer. Never blame the teacher or the child.

## 10. Accessibility and performance
WCAG AA contrast (tokens above). Visible focus ring: 2 px clay, offset 3 px, rounded. Full keyboard path on reviewer and officer screens. Labels on every control; captions for all audio. Lighthouse a11y 95+ on public pages. LCP under 2 s on a mid range phone over 4G; the teacher app shell under 200 KB of JS on first load; Motion loaded lazily where possible.

## 11. Do and don't
**Do:** warmth, generous space, one strong action, real names, real voices, honest progress, delight on success.
**Don't:** leaderboards, points versus colleagues, purple gradients, glassmorphism, grey shadows, stock photos, emoji as UI, raw errors, spinners, walls of text, English only screens, anything that looks like a government form.
