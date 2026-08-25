---
name: Bulk Image Resizer
description: A precise optical light table for local-first batch image preparation.
colors:
  field: "#070807"
  workspace: "#0a0b0a"
  ink: "#f3f2ed"
  muted: "#adb0a8"
  line: "#292b28"
  panel: "#111210"
  signal: "#d9ff4f"
  danger: "#ff6b5c"
typography:
  display:
    fontFamily: '"Manrope Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: "clamp(64px, 10.4vw, 158px)"
    fontWeight: 560
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Manrope Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: "clamp(56px, 7vw, 94px)"
    fontWeight: 560
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"Manrope Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: "15px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Manrope Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: 'ui-monospace, "SFMono-Regular", monospace'
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.12em"
rounded:
  none: "0"
  circle: "50%"
spacing:
  compact: "7px"
  tight: "10px"
  row-gap: "18px"
  panel-edge: "34px"
  content-edge: "42px"
components:
  wordmark:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#090a09"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "57px"
  button-primary-hover:
    backgroundColor: "{colors.signal}"
    textColor: "#090a09"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "57px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "7px 0"
  segment-active:
    backgroundColor: "{colors.signal}"
    textColor: "#0b0c0a"
    rounded: "{rounded.none}"
    height: "36px"
  segment-idle:
    backgroundColor: "transparent"
    textColor: "#8f918b"
    rounded: "{rounded.none}"
    height: "36px"
  preset-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "29px"
  range-input:
    backgroundColor: "#42443f"
    rounded: "{rounded.none}"
    height: "2px"
  image-ledger-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0"
    height: "104px"
  toast-error:
    backgroundColor: "{colors.ink}"
    textColor: "#111111"
    rounded: "{rounded.none}"
    padding: "13px 16px"
---

# Design System: Bulk Image Resizer

## Overview

**Creative North Star: "Optical Light Table"**

Bulk Image Resizer is an operating surface, not a decorative container. Its near-black field behaves like a darkroom light table: image proofs are the luminous content, while hairline dividers, mono readouts, and aligned controls provide calibration structure. The empty state uses monumental type to make the one available action unmistakable; the populated state compresses into an image ledger and a single settings rail.

The system is calm, exact, and flat. Warm off-white ink and muted gray-green metadata establish the hierarchy; acid-lime is rare and therefore authoritative, appearing for active choices, progress, successful outcomes, and keyboard focus. Rectangular controls and edge-to-edge divisions keep the tool instrument-like. Circular geometry is reserved for marks, slider thumbs, and compact status or removal controls.

**Key Characteristics:**

- Near-black working fields with warm luminous image and text contrast.
- Monumental variable Manrope for first-viewport instruction and batch scale.
- Monospaced calibration labels for indices, dimensions, formats, values, and metadata.
- Hairline structure, flat tonal layering, and one compact settings rail.
- Acid-lime used only for state, progress, focus, and confirmed success.

## Colors

The palette is a dark optical field with warm paper ink, gray-green calibration neutrals, and two tightly controlled signals.

### Primary

- **Acid-Lime Signal** (`signal`): Marks selected segments, live values, progress, successful export state, drag acceptance, and visible keyboard focus.

### Tertiary

- **Coral Fault** (`danger`): Reserved for destructive hover intent and error emphasis.

### Neutral

- **Warm Proof Ink** (`ink`): Primary text, default export controls, and the luminous foreground against both working fields.
- **Darkroom Field** (`field`): The empty-state canvas and deepest optical black.
- **Ledger Field** (`workspace`): The populated working canvas and sticky-header base.
- **Instrument Panel** (`panel`): The settings rail's single tonal layer.
- **Calibration Gray** (`muted`): Secondary instructions, metadata, and supporting copy.
- **Hairline Graphite** (`line`): Structural rules between header, ledger, groups, and rail.

### Named Rules

**The Signal Is State Rule.** Acid-lime must communicate active selection, progress, focus, drag readiness, or success; it is never ambient decoration.

**The Two-Field Rule.** Use the darkroom field for the monumental empty state and the ledger field for the populated workspace; do not introduce unrelated dark surface colors as pseudo-cards.

## Typography

- **Display Font:** Manrope Variable (with Apple system sans-serif fallbacks)
- **Body Font:** Manrope Variable (with Apple system sans-serif fallbacks)
- **Label/Mono Font:** ui-monospace (with SFMono-Regular and monospace fallbacks)

**Character:** Variable Manrope supplies optical scale without theatrical ornament: dense, direct, and slightly compressed through tight tracking. Monospaced labels turn technical details into stable calibration marks rather than secondary prose.

### Hierarchy

- **Display** (560, fluid 64–158px, 0.92 line-height): The empty-state drop instruction; on narrow screens it uses the implemented 54–88px mobile range.
- **Headline** (560, fluid 56–94px, 0.9 line-height): Batch count and other workspace-scale quantities.
- **Title** (650, 15px): Settings-rail heading.
- **Body** (600, 13px): Image names and primary action labels; supporting prose becomes smaller and lighter.
- **Label** (500, 10px, 0.12em tracking): Uppercase wordmark, privacy statement, footer compatibility list, and row indices. Other mono measurements remain 9–15px according to hierarchy.

### Named Rules

**The Optical Scale Rule.** Monumental type belongs to the one decisive instruction or batch quantity; operating controls stay compact.

**The Calibration Voice Rule.** Use the mono stack for machine-readable facts—formats, percentages, dimensions, sizes, indices, and terse status—not for conversational instructions.

## Layout

The empty state fills the viewport in three bands: a 74px header, a flexible drop field, and a 62px footer. A faint one-pixel vertical calibration line bisects the field. The drop target spans the remaining viewport and keeps its title left-aligned inside fluid 40–110px padding.

The populated workspace uses a 74px sticky header and a batch heading at least 190px tall. Below, the operating grid is `minmax(0, 1fr) 390px`: an image ledger with 42px horizontal insets and a fixed settings rail with 34px insets. Ledger rows are at least 104px tall and use five aligned columns for index, proof, identity, target/result, and removal.

At the exact 840px breakpoint, the rail stacks beneath the ledger, the vertical divider becomes a top rule, and the batch heading contracts to 160px. At the exact 560px breakpoint, outer insets contract to 20–22px, the empty header becomes 62px, the footer becomes 72px and stacks, batch totals and lower-priority ledger readouts disappear, and ledger rows collapse to proof, identity, and removal columns at a minimum 86px height.

Spacing is compact and structural. Repeated gaps use the documented 7px, 10px, and 18px steps; major panel and content edges use 34px and 42px. Preserve these incumbent values rather than normalizing them to a generic 4px or 8px scale.

## Elevation & Depth

Bulk Image Resizer is flat by default and uses no card shadows. Depth comes from black-on-black tonal layering, one-pixel dividers, sticky-header translucency, and luminous image proofs. The sticky workspace header uses a translucent ledger field with an 18px backdrop blur. Shadows are exceptional: the wordmark's inset ring cuts its circular mark, while the floating toast uses a deep ambient shadow because it must detach from the working plane.

### Shadow Vocabulary

- **Cutout Mark** (`inset 0 0 0 3px #070807`): Creates the optical ring inside the 13px wordmark dot.
- **Floating Alert** (`0 14px 45px rgba(0,0,0,.45)`): Lifts transient toast feedback; an error also receives a 3px inset coral top signal.

### Named Rules

**The Flat Light Table Rule.** Working surfaces remain flat and divided by tone or a one-pixel line; only transient feedback may float.

## Shapes

The form language is square and edge-aligned. Primary actions, segmented controls, preset controls, proof thumbnails, panels, ledger rows, and overlays have no corner radius. The only rounded form is a true circle: the 13px wordmark mark, 15px slider thumb, 26px success mark, and 28px removal target. This contrast makes circular marks read as instruments or status indicators rather than softened containers.

Borders are one-pixel calibration lines. Avoid outlined card silhouettes; borders divide a continuous working plane or define a compact control group.

## Components

### Buttons

- **Shape:** Rectangular and radius-free for text, segment, preset, and primary actions; only the compact removal target is circular.
- **Primary:** A full-width 57px warm-ink bar with dark text and 18px horizontal padding. Hover shifts the fill to acid-lime; the successful “Show in Finder” state is acid-lime at rest.
- **Hover / Focus:** Hover changes color without lift. Keyboard focus uses a 2px acid-lime outline with a 3px offset. Disabled primary actions use 50% opacity and a wait cursor.
- **Text:** Transparent, 12px semibold, and minimally padded. The Add action includes a 16px hairline icon; hover shifts to acid-lime.
- **Segmented / Preset:** Mono 10px labels. Selected format segments use acid-lime fill and dark text; selected scale presets retain the dark field and brighten only their border and text.

### Cards / Containers

- **Corner Style:** Square (`rounded.none`).
- **Background:** Continuous field, ledger field, and one instrument-panel tone; never standalone decorative cards.
- **Shadow Strategy:** Flat at rest; see Elevation & Depth.
- **Border:** One-pixel graphite rules establish rows and groups.
- **Internal Padding:** 42px on the desktop ledger and 34px on the settings rail, contracting to 22px on narrow screens.

### Inputs / Fields

- **Style:** Native range input reduced to a 2px graphite track with a 15px circular acid-lime thumb. Fieldsets are borderless except for a one-pixel top divider between settings groups.
- **Focus:** The global 2px acid-lime outline and 3px offset remains visible.
- **Disabled:** Range controls use 28% opacity; the PNG quality group dims to 48% while clearly reporting “Lossless.”

### Navigation

The 74px header is a utility bar, not site navigation. The BULK IMAGE RESIZER wordmark sits left; compact Add and Clear actions sit right with a 26px gap. On narrow screens the header retains the actions but hides the nonessential privacy note. The populated header stays fixed to the top through translucency and blur.

### Image Ledger Row

Each row is a hairline-separated proof record. A mono two-digit index leads a fixed 72 × 64px cover-cropped proof (`object-fit: cover`), followed by a truncated name, mono source facts, a mono target or acid-lime result, and a circular remove action. At the narrow breakpoint, the proof becomes 58 × 54px and the index plus target/result readouts are removed to protect the identity column.

### Feedback

Processing appears inline in the settings rail with a 2px acid-lime progress fill. Success pairs a circular acid-lime check with compact outcome copy. Errors use a warm-ink floating toast with dark text, coral inset rule, and ambient alert shadow. Dragging over a populated workspace produces an inset 14px acid-lime overlay with monumental dark text.

## Do's and Don'ts

### Do:

- **Do** keep acid-lime accountable to active state, progress, focus, drag readiness, or success.
- **Do** structure dense operating views with one-pixel lines, aligned mono facts, and a single tonal settings rail.
- **Do** let image proofs provide the visual luminosity while the interface recedes into near-black fields.
- **Do** preserve the exact 840px and 560px responsive transitions and their information-priority changes.
- **Do** respect reduced motion by collapsing transition and animation durations to 0.01ms.

### Don't:

- **Don't** add decorative cards, color-wash gradients, rounded rectangles, or diffuse shadows to ordinary working surfaces; the empty field's one-pixel calibration line is structural.
- **Don't** use acid-lime for branding wash, decorative highlights, or passive metadata.
- **Don't** replace the monumental empty-state instruction with a conventional upload card or small dashed drop zone.
- **Don't** use mono type for conversational instructions or Manrope display type for dense measurement readouts.
- **Don't** round proof thumbnails or rectangular controls; circles are reserved for marks, thumbs, status, and compact removal.
