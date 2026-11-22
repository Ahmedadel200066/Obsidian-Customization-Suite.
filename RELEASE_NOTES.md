# Customization Studio 1.2.0

Feature release. It adds Light/Dark profiles, a neutral Default profile, nine
card shapes for Obsidian Bases with per-shape controls, and a master pause
switch, plus fixes for text visibility and a repeating save error.

## What's new

### Profiles and appearance

- **Neutral Default profile.** On first run the plugin creates an editable
  Default profile from your current appearance and selects it. Nothing
  visibly changes when you enable the plugin. It inherits your theme and
  snippets instead of forcing a dark palette. Existing profiles are kept.
- **Create from current.** New profiles are created as a copy of Default.
  To copy a preset instead, use Manage profile, then Duplicate.
- **Light and Dark variants.** Every profile can follow Obsidian or the
  system, or be fixed to Light or Dark. Global and integration settings have
  separate Light and Dark values, and the built-in presets include paired
  palettes.
- **Master Enabled/Paused toggle.** Pause all Customization Studio effects
  without losing your profiles.
- **Instant apply.** Controls update the current layout without reloading
  the vault. Valid text and CSS edits apply as you type, and pending text
  edits are saved when the plugin unloads.

### Obsidian Bases card shapes

- **Nine shapes:** Standard, Book, Poster, Circle, Spine, Polaroid, Trading
  card, Disc, and Ticket.
- **Per-shape settings.** Each shape has its own controls, for example Book
  depth and page-edge thickness, Disc protrusion and diameter, Poster print
  border, Circle crop, Polaroid tilt, Trading card sheen, and Ticket notch.
- **Size.** Every shape has an artwork size from 50% to 150%, using native
  card layout so text keeps its native font and position.
- **Hover effects.** Every shape can add Glow, Lift, Flip artwork, or Wiggle.
  They default to Off and are disabled for reduced motion and touch.
- **Book refinement** and a **text visibility fix**: card text and metadata
  stay inside the native card and in front of the artwork.
- **Live re-measurement** when sizes or layouts change.

### Import, export and safety

- Export and import now include both variants and the shape settings. A
  Legacy JSON export keeps only the current look.
- New settings are saved in `studio-appearance.json` with a `.bak` copy and
  interrupted-save recovery. `data.json` stays readable by 0.1.1.

### Fixes

- Fixed a repeating "EEXIST: file already exists" notice on every save. The
  backup now overwrites the old copy, and a failed backup is logged once and
  no longer blocks saving.

## Upgrading

Install the three release assets over the existing plugin files and keep your
`data.json` and `studio-appearance.json`. Back them up first. If you go back
to an older build, restore a matching pair of settings files.

## Known limits

- Shape targeting is a temporary, pane-scoped preview. Pick a pane under
  Temporary shape target if more than one cards view is open. It is not a
  saved-view rule.
- Default inherits external themes and snippets. It does not turn their CSS
  into controls. There is no direct integration with Style Settings or Style
  Manager, so overlapping CSS variables are possible.
- The Kanban right-click card color menu is not included.

## Install

Download these three release assets and put them directly inside
`<vault>/.obsidian/plugins/customization-studio/`, then reload Obsidian and
enable Customization Studio under Community plugins:

- `main.js`
- `manifest.json`
- `styles.css`

GitHub's automatic source-code archives are not runtime packages. The MIT
license remains in the repository and its full notice is embedded in main.js.
Published 0.1.0 and 0.1.1 assets and tags are unchanged.

## Compatibility and test status

The manifest minimum is Obsidian 1.9.0 for Bases. Individual integrations
need compatible target plugins. Source inspected: Kanban 2.0.51, Spaced
Repetition 1.15.4, Tasks 8.6.0, Dataview 0.5.68, Calendar 1.5.10, and Day
Planner 0.35.1. Tasks 8.6.0 itself requires Obsidian 1.13.1.

Automated tests and browser fixtures pass, but they are not a substitute for
real Obsidian testing. Native task editing, review sessions, drag/resize,
mobile, theme interactions, restart persistence, and popouts still need manual
vault checks. See GROWTH_VERIFICATION.md and README.md in the repository.

Support: https://buymeacoffee.com/medoadel20y
