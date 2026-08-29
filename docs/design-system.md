# H2O–8 Design System

A small, single-purpose system extracted from the water-tracking app prototype in
this project (`Water Tracker.dc.html`). It describes one product: a phone app for
counting 250 ml cups of water against a daily minimum of eight.

## Sources

- `Water Tracker.dc.html` — the working prototype this system was derived from.
  Turn 2 (`#2a`) is the built flow: Today / Days / Alerts / Setup, plus a day-detail
  sheet. Turn 1 holds the three home-screen explorations.
- `ios-frame.jsx` — the iPhone bezel used for all screens (402 × 874).
- No brand guidelines, logo files, or codebase were supplied. There is **no logo**:
  the product name is set in plain type (`H2O–8`, IBM Plex Mono, 0.2em tracking)
  wherever a mark would go. Nothing has been drawn or invented to fill that gap.

## Design intent

Dieter Rams and Teenage Engineering, applied to a counter. Warm grey paper, near-black
ink, hairline rules, a hard grid, and one orange doing only two jobs: marking *now*
and marking the primary act. The interface looks like a measuring instrument, not a
wellness app — no gradients, no glassmorphism, no water illustrations, no emoji, no
badges or streak confetti.

## Visual foundations

**Colour.** Three warm paper tones (`--paper-1/2/3`), a five-step ink ramp used for
hierarchy instead of extra hues, four rule weights, and a single accent
(`#f25c1f`) with hover and press variants. Ink ramp does all the work usually given
to colour: `--ink-1` for primary values, `--ink-2` for notes, `--ink-3` for mono
labels, `--ink-5` for things that haven't happened yet. No semantic red/green —
falling short of the goal is shown by absence (hollow cells), not by warning colour.

**Type.** Two families, both open-source. Archivo (400/500/600) for prose, titles,
and the oversized numerals; IBM Plex Mono (400/500/600) for every number, time,
volume, and uppercase label. The rule is absolute: if it's data, it's mono. Uppercase
mono labels always carry `0.14em` tracking (`0.2em` for the product name). Display
numerals run 108px at 0.82 line-height with `-0.05em` tracking, deliberately far
larger than anything else on screen.

**Spacing and layout.** 24px screen gutter, 58px top clearance for the status bar,
12px row padding, 4px between progress segments, 8px between day columns. Content is
gutter-aligned, not centred; the only centred elements are pager labels and the
button's own label. Sections are separated by a 1px full-ink rule; rows by a
`#d6d3cc` hairline; not-yet rows by `#e4e1da`.

**Backgrounds and texture.** Flat colour only. No imagery, no patterns, no grain, no
gradients anywhere. Depth comes from the ink/paper contrast and from one inset panel
tone (`--paper-2`).

**Corners, borders, shadows.** Square by default (`--radius-0`); 2px for small square
controls, 3px for the primary action, and the pill radius only in the round-button
variant explored in turn 1. No shadows in the built flow. Cards are not cards —
they're either bare content on the paper or a flat `--paper-2` panel with no border
or shadow.

**Motion and states.** Almost none. State changes land instantly; there are no
transitions on colour. Hover darkens the accent or dims a tappable chart column to
0.62 opacity; press darkens further, and the round-button variant drops 4px onto its
hard 6px offset shadow. Toasts appear as an ink slab and leave after 2.2s. No fades,
no bounce, no spring.

**Transparency and blur.** Never used. Overlays are opaque paper slabs that sit
*below* the device status bar (z-index under the frame chrome) so the clock and
island always read.

## Content fundamentals

Lowercase sentence case for prose, uppercase mono for labels and system messages.
Copy is dry and factual with a light touch: "Six cups down. Two to go.", "A minimum,
not a ceiling. Extra cups are counted.", "Weekends run higher. Wednesday is the one
to watch." Second person, never first. No exclamation marks, no cheerleading, no
"Great job!". Overshooting is acknowledged plainly — "1 cup past goal", "bonus" —
never corrected. Times are 24-hour, volumes two decimals in litres, counts
zero-padded (`06`, not `6`). No emoji. The one non-alphabetic glyph in the system is
`✦` in the goal banner and `●` in the toast.

## Iconography

There is none, and that is the position: navigation and controls are set in words
(`TODAY`, `DAYS`, `UNDO`, `+ ADD A TIME`). Where a glyph is unavoidable, a single
unicode character is used at label size — `‹ ›` for paging, `✕` to dismiss, `›` as
the settings-row disclosure, `●`/`✦` as status marks. No icon font, no SVG set, no
CDN icon library is referenced. If an icon set is ever needed, it should be chosen
and documented here rather than improvised per screen.

## Index

- `styles.css` — the entry point; imports everything below.
- `tokens/fonts.css` — Google Fonts import for Archivo + IBM Plex Mono (no vendored binaries).
- `tokens/colors.css` — paper, ink, line, accent, and semantic aliases.
- `tokens/typography.css` — families, weights, composed `font:` shorthands, tracking.
- `tokens/spacing.css` — scale, gutters, control sizes, radii.
- `tokens/motion.css` — durations and press/hover constants.
- `guidelines/*.card.html` — foundation specimen cards (Colors, Type, Spacing, Patterns).
- `components/core/` — ActionButton, SegmentBar, LedgerRow, MonoLabel, NumeralReadout,
  ToggleSwitch, StepperHeader, TabBar, DayColumn (each with `.d.ts` and `.prompt.md`).
- `Water Tracker.dc.html` — the UI kit, in practice: the full interactive flow.

## Caveats

- Fonts are loaded from Google Fonts rather than vendored binaries. Supply the real
  files if this needs to work offline.
- This project is a design project, not a design-system project, so the component
  bundle isn't compiled here: the component cards are hand-built specimens rather
  than live mounts of the `.jsx` files. Moving these files into a design-system
  project will make them compile.
