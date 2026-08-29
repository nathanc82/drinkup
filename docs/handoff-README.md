# Handoff: H2O–8 — daily water intake tracker

## Overview

H2O–8 is a phone app for counting cups of water against a daily minimum. One cup is
250 ml, the goal is 8 cups (2 L), and there are no other serving sizes — that single
constraint drives the whole interface. Logging is one tap; removing a cup is a long
press on the same control. Falling short of the goal is shown by absence (hollow
cells), never by warning colour. Overshooting is acknowledged plainly, never
corrected.

Two things are in this bundle:

1. **A working installable web app** (`app/`) — the built product. Vanilla JS, no
   build step, `localStorage` only, service worker for offline, installable to the
   iOS Home Screen. This is real code, not a mock.
2. **Design references** (`*.dc.html`, `silhouette-test/`) — HTML prototypes of the
   flow plus an experimental home screen with a particle-fluid figure. These are
   references for intent, not production code.

## About the design files

The `.dc.html` files are **design references created in HTML**. They show intended
look and behaviour. They are authored in a component format that needs `support.js`
alongside them to render, and they open directly in a browser with no build step
(`open "Water Tracker.dc.html"`, or serve the folder over a local HTTP server).

The task, if you're continuing this project in a real codebase, is to **recreate
these designs in your target environment** (React, Vue, SwiftUI, native iOS) using
its established patterns — not to lift the HTML. The exception is `app/`, which is a
finished vanilla-JS implementation you can either ship as-is or port.

If no environment exists yet, the practical choice is: continue with `app/` as a PWA
(cheapest, works today, weak notification guarantees on iOS), or rebuild native in
SwiftUI if reliable reminders matter. That trade-off is spelled out in
`app/README.md`.

## Fidelity

**High-fidelity.** Colours, typography, spacing, and interaction states are final and
documented in `tokens/`. Recreate the UI pixel-accurately. All screens were designed
against an iPhone frame of **402 × 874** logical pixels.

The one exception is the silhouette home screen (`Silhouette Home v2.dc.html`) — an
exploration, not an accepted direction. It is included because the fluid simulation
inside it is substantial work worth keeping.

---

## Screens

The built flow is four tabs plus one overlay sheet. `app/app.js` implements all of
them; `Water Tracker.dc.html` turn 2 (`#2a`) is the interactive prototype.

### 1. Today

**Purpose:** log a cup, see today's count and the times of each cup.

**Layout,** top to bottom, all content on a 24px screen gutter with 58px top
clearance for the status bar:

- **Header row** — `TODAY` in uppercase mono label (10px, 0.14em tracking,
  `--ink-3`), with the date on the right in the same style.
- **Display numeral** — the cup count, `600 108px/0.82 Archivo`, `-0.05em` tracking,
  `--ink-1`. Zero-padded (`06`, not `6`). This is deliberately the largest thing on
  any screen. Beside it, the volume in litres to two decimals in mono.
- **Segment bar** — 8 cells, 24px tall, 4px gaps, square corners. Filled cells are
  solid `--ink-1`; empty cells are transparent with a `#bfbcb5` 1px edge. Cups past
  8 append **orange** (`--accent-1`) cells and the bar keeps growing.
- **Section rule** — 1px full-ink (`--line-1`) separating the readout from the
  ledger.
- **Ledger** — one row per logged cup: zero-padded index, 24-hour time, `250 ML`, all
  in mono, 12px vertical padding, separated by `#d6d3cc` hairlines. Rows for cups not
  yet logged are ghosts: `--ink-5` text on `#e4e1da` hairlines. The list scrolls.
- **Primary action** — `+ ONE CUP`, full width, 58px tall, 3px radius, `--accent-1`
  background, white label in uppercase mono. Tap logs a cup. **Press and hold**
  removes the last cup. Hover darkens to `--accent-hover`; press to `--accent-press`.
- **Tab bar** — `TODAY · DAYS · ALERTS · SETUP` in uppercase mono; the active tab is
  `--ink-1`, the rest `--ink-3`. No icons.

**Toast:** after logging, an ink slab (`--ink-1` background, `--paper-1` text) with a
`●` mark appears for 2.2s: "Six cups down. Two to go." Past the goal: "1 cup past
goal".

### 2. Days

> **Open decision — documented design and built app differ.**
> This section describes segmented week columns (a vertical stack of
> segment-bar cells per day, orange past 8) and a plain-language
> observation line beneath the chart. Neither is what ships. The built
> `screenDays()` in `app.js` draws one solid proportional bar per day and
> instead shows a day-streak readout plus a Days-at-goal / Total / Daily
> average table — none of which appear below. `DayColumn` in
> `docs/components/core/` is the segmented version. Which direction wins
> has not been decided; treat this section as a proposal, not a spec.

**Purpose:** see the week's pattern and open any past day.

- **Week pager** — `‹` and `›` square 34px controls flanking a centred week label
  (`18 – 24 AUG`). Disabled at the ends of the logged range.
- **Week chart** — 7 columns, 118px tall, 8px gaps. Each column is a vertical stack
  of cells matching the segment-bar treatment: filled ink for logged cups, hollow for
  the remainder, orange for cups past 8. Under each column, the weekday initial and
  the date in mono. Today's column is marked with `--accent-1`. Future days are
  ghosted and not tappable.
- Tapping a column opens the **day sheet**.
- Below the chart, a plain-language observation in sentence-case prose, e.g.
  "Weekends run higher. Wednesday is the one to watch."

### 3. Alerts

**Purpose:** reminder times.

- A list of reminder times in mono, each with a delete affordance, followed by
  `+ ADD A TIME`.
- **Smart skip** toggle — when on, a reminder is suppressed if a cup was logged in
  the last hour. Toggle track is `--ink-1` when on, `--line-2` when off, white knob.
- Honest copy about iOS delivery limits (see `app/README.md`).

### 4. Setup

**Purpose:** goal, cup size, day boundary, data.

- Settings rows, 12px vertical padding, hairline separated, label left in sentence
  case, value right in mono, `›` disclosure where a row drills in.
- **Stepper header** rows for goal (default 8) and cup size (default 250 ml).
- **Day start** — hour at which a cup counts toward the previous day (default 04:00).
  A cup logged at 02:00 belongs to yesterday.
- **Export CSV** — downloads `h2o8-YYYY-MM-DD.csv` with `date,time,cup,ml` rows.
- **Erase all data** — deliberate wipe.
- Footer in 10px mono, `--ink-4`: `H2O–8 · VERSION 1.0 / NO ACCOUNT. NO ADS. NO
  NETWORK. / N DAYS STORED ON THIS DEVICE.`

### 5. Day sheet (overlay)

**Purpose:** review and edit one past day.

- An **opaque** `--paper-1` slab. It sits *below* the device status bar in z-order so
  the clock and island always read. No blur, no transparency, no scrim.
- Header: the date, the count, and the litres; `✕` at 34px to dismiss.
- `‹ ›` paging between days, bounded by the first logged day and today.
- The same ledger rows as Today, editable: times can be changed, cups removed.

---

## Interactions & behaviour

- **Log a cup:** tap the primary action. State writes immediately, toast appears.
- **Undo:** press and hold the primary action. The hold flag suppresses the click
  that would otherwise follow.
- **Navigation:** tab bar switches screens instantly. No transitions.
- **Motion budget is near zero by design.** No colour transitions, no fades, no
  spring, no bounce. The only movement in the whole app is the toast appearing and
  the primary action's 4px press shift. `--dur-fast` is 90ms and `--ease-standard` is
  `linear`.
- **Hover:** the accent darkens; tappable chart columns drop to 0.62 opacity.
- **Rollover:** the app re-renders on `visibilitychange` so the day rolls over
  correctly when the phone is picked up.
- **Reminders:** armed with `setTimeout` while the app runs. iOS only delivers web
  notifications for Home-Screen-installed apps (16.4+) and schedules them
  opportunistically, so a nudge can be skipped. The log is never affected.

## State management

All state is one object persisted to `localStorage` under `h2o8.v1`:

```
goal: 8              // cups per day
cupMl: 250           // ml per cup
dayStart: 4          // hour a new logical day begins
sound: false
smart: true          // skip a reminder if a cup was logged in the last hour
reminders: [                              // one entry per reminder
  { t: "07:00", label: "on waking", on: true },
  …                                       // t = "HH:MM", label = prose,
]                                         // on = whether it fires
log: { "YYYY-MM-DD": [ "HH:MM", … ] }   // one entry per cup
```

Derived, never stored: cup count per day (`log[key].length`), litres
(`count * cupMl / 1000`, two decimals), the logical date (a cup before `dayStart`
belongs to the previous day), and the first logged date (bounds the pagers).

Transient view state (current tab, visible week, open sheet, row being edited) is
kept in memory only and resets on launch.

There is no network layer, no account, no sync. A second device is a separate log.

## Design tokens

Authoritative values live in `tokens/*.css` and are imported by `styles.css`.
Summary:

**Paper:** `#e9e7e2` app background · `#dedbd4` inset panel · `#fbfaf8` lightest
surface, sparingly.

**Ink ramp** (does the work usually given to extra hues): `#17171a` primary ·
`#6c6a64` secondary · `#8b8880` mono labels · `#a8a5a0` tertiary · `#c2bfb8` ghost
rows and unlogged values.

**Rules:** `#17171a` section rule · `#d6d3cc` row hairline · `#e4e1da` ghost hairline
· `#c9c6bf` disabled control edge. All 1px.

**Accent** — one only, doing two jobs: marking *now* and marking the primary act.
`#f25c1f` · hover `#d94d13` · press `#a83c0e`. No semantic red or green anywhere.

**Type** — two open-source families. **Archivo** 400/500/600 for prose, titles and
the oversized numerals. **IBM Plex Mono** 400/500/600 for every number, time, volume
and uppercase label. The rule is absolute: if it's data, it's mono.

| Role | Value |
|---|---|
| numeral | `600 108px/0.82 Archivo`, `-0.05em` |
| numeral small | `600 68px/0.82 Archivo`, `-0.05em` |
| display | `600 40px/1 Archivo`, `-0.03em` |
| title | `400 22px/1.35 Archivo` |
| body | `400 14px/1.3 Archivo` |
| body small | `400 13px/1.6 Archivo` |
| data | `500 14px/1 IBM Plex Mono` |
| label | `500 10px/1 IBM Plex Mono`, `0.14em` |
| axis | `400 9px/1 IBM Plex Mono` |

Every uppercase mono label carries `0.14em` tracking; the product name `H2O–8` uses
`0.2em`.

**Spacing scale:** 4 · 8 · 10 · 14 · 18 · 24 · 26 · 34 px. Screen gutter 24px, status
clearance 58px, segment gap 4px, day-column gap 8px, row padding 12px vertical.

**Radii:** 0 by default (bars, segments, panels are square) · 2px small controls ·
3px primary action · 29px pill, used only in one turn-1 exploration.

**Control sizes:** primary action 58px tall · square controls 34px · minimum tap
target 44px · segment bar 24px · week chart 118px.

**Backgrounds:** flat colour only. No gradients, imagery, patterns, grain, blur, or
transparency anywhere. Depth comes from ink-on-paper contrast and one inset panel
tone.

## Components

`components/core/` holds nine components, each with a `.jsx` implementation, a `.d.ts`
signature, and a `.prompt.md` describing intent and constraints:

ActionButton · SegmentBar · LedgerRow · MonoLabel · NumeralReadout · ToggleSwitch ·
StepperHeader · TabBar · DayColumn

`guidelines/*.card.html` are specimen cards for colours, type, spacing, states,
ledger rows, segment bars and toasts — useful as visual acceptance targets.

## Iconography

**There is none, and that is the position.** Navigation and controls are set in words
(`TODAY`, `DAYS`, `UNDO`, `+ ADD A TIME`). Where a glyph is unavoidable a single
unicode character is used at label size: `‹ ›` paging, `✕` dismiss, `›` disclosure,
`●` toast mark, `✦` goal banner. No icon font, no SVG set, no CDN icon library. If an
icon set is ever needed it should be chosen and documented, not improvised per
screen.

## Copy rules

Lowercase sentence case for prose, uppercase mono for labels and system messages.
Dry and factual, second person, never first. No exclamation marks, no cheerleading,
no "Great job!". Times are 24-hour. Volumes are two decimals in litres. Counts are
zero-padded. No emoji.

---

## The silhouette exploration

`Silhouette Home v2.dc.html` is an alternative home screen: a genderless outline
figure acts as the vessel, filling with liquid as cups are logged. The liquid is a
real particle simulation — it responds to phone tilt and to shaking, settles flat
when the phone is still, and pours in at the mouth when a cup is added. At 8 cups the
head fills to the crown.

**Status: exploration, not accepted.** The built flow (`app/`) does not use it.

Files:

- `silhouette-test/fluid-lab.js` — the simulation engine, an ES module. Clavet-style
  double density relaxation with viscosity, cohesion and XSPH velocity smoothing.
  Every constant is a live per-instance parameter.
- `silhouette-test/index.html` — standalone phone test page. Serve over **HTTPS** or
  iOS will not offer the tilt permission prompt. Has a drag fallback on desktop.
- `Fluid Lab.dc.html` — a comparison board of five fluid models side by side with per
  model tweak controls (grain, viscosity, springiness, smoothing, damping, wall grip,
  cohesion, blob size, fusion). Model **1c "Syrup"** is the one adopted in v2.
- `Silhouette Home.dc.html` — the earlier version, on a coarser engine
  (`silhouette-test/fluid.js`). Kept for comparison; the old engine can be deleted.

The adopted parameter set, from `Silhouette Home v2.dc.html`:

```js
{ spacing: 6.5, k: 6, knear: 1.4, visc: 0.70, visc2: 0,
  xsph: 0.60, damp: 0.990, wallFriction: 0.85, cohesion: 0.15,
  sub: 3, radiusFactor: 0.86 }
```

Notes if you pick this up:

- The figure is defined once as an SVG path in figure units (240 × 480) and used
  three times: as the visible outline stroke, as a CSS `clip-path` on the canvas, and
  rasterised into a signed distance field for particle collision. Keep them in sync.
  All subpaths must wind the same direction — opposite windings cancel under nonzero
  fill and punch a hole at the neck.
- Particles are drawn as discs and fused into a continuous body by an SVG blur +
  colour-matrix threshold filter (a metaball pass), which is what makes it read as
  ink rather than dots.
- Cup levels are calibrated waterlines (`TARGETS` in figure units), not particle
  counts. Volume walks toward the target a few particles per frame and then
  **latches** — once the level is reached the regulator stops. This matters: running
  it every frame keeps stirring the body and it never goes still.
- There is no idle animation. The liquid only moves from gravity (device
  orientation) and shakes.

---

## Files in this bundle

**The built app — real code, runnable**

- `app/index.html` · `app/app.js` — shell and the entire app
- `app/manifest.webmanifest` · `app/sw.js` · `app/icon-*.png`
- `app/README.md` — how to host and install it on a phone

**Design system**

- `design-system.md` — the written system: intent, foundations, content rules
- `styles.css` — entry point, imports the tokens
- `tokens/colors.css` · `typography.css` · `spacing.css` · `motion.css` · `fonts.css`
- `guidelines/*.card.html` — specimen cards
- `components/core/*` — nine components, each `.jsx` + `.d.ts` + `.prompt.md`

**Design references — prototypes, not production code**

- `Water Tracker.dc.html` — the full flow; turn 2 is the built prototype, turn 1
  holds three home-screen directions
- `Design System.dc.html` — the system rendered as a browsable document
- `Silhouette Home v2.dc.html` · `Silhouette Home.dc.html` · `Fluid Lab.dc.html`
- `silhouette-test/index.html` · `fluid-lab.js` · `fluid.js`
- `support.js` — runtime the `.dc.html` files need to render
- `ios-frame.jsx` — the iPhone bezel used for every screen (402 × 874)

**Reference material**

- `reference-material/drinkup_sketch_v1.jpg` — the original hand sketch the
  silhouette direction came from
- `reference-material/pasted-1787111872715-0.png` ·
  `reference-material/pasted-1787155561720-0.png` — images supplied during the work,
  used as visual reference for the silhouette direction

## Caveats

- Fonts load from Google Fonts; no binaries are vendored. Supply real `.woff2` files
  if this must work offline from first launch.
- There is **no logo**. The product name is set in plain type (IBM Plex Mono, 0.2em
  tracking) wherever a mark would go. Nothing was invented to fill that gap.
- The component bundle isn't compiled here — the guideline cards are hand-built
  specimens rather than live mounts of the `.jsx` files.
- `silhouette-test/fluid.js` is the superseded engine. `Silhouette Home.dc.html` is
  the only thing still referencing it.
