# Customization Studio 1.2.0

Feature release: Light/Dark profiles, neutral Default profile, per-shape
Bases card settings, and a save-error fix.

## Install

Download these three release assets:

- `main.js`
- `manifest.json`
- `styles.css`

Put them directly inside `<vault>/.obsidian/plugins/customization-studio/`,
then reload Obsidian and enable Customization Studio under Community plugins.
If your vault uses a different configuration folder, use that folder instead
of `.obsidian`. Test in a disposable vault or back up your existing plugin
folder and data.json first. Do not overwrite data.json.

This release attaches exactly those three files. GitHub's automatic source-code
archives are not runtime packages. The MIT license remains in the repository
and its full notice is embedded in main.js.

## Changes since 0.1.1

- Neutral, editable Default profile created on first run from your current
  appearance. Nothing visibly changes when you enable it.
- Follow Obsidian, Light, or Dark per profile, with paired preset palettes.
- Per-shape settings for Bases cards (size, Disc protrusion, hover effects
  that default to Off) with live re-measurement.
- Export and import of profile variants and shape settings, with backups and
  interrupted-save recovery.
- Master pause and resume switch.
- Fixed a repeating "EEXIST: file already exists" notice on every save. The
  appearance backup now overwrites the old copy, and a failed backup no longer
  blocks saving.

Published 0.1.0 and 0.1.1 assets and tags are unchanged. This release has
not had a full real-vault test across themes, Style Settings, or mobile.

## Included

- Profile-based appearance controls for Kanban, Spaced Repetition, and Bases.
- Opt-in Tasks, Dataview, Calendar, and Day Planner integrations. Duplicate a
  built-in profile, open Integrations, and enable the desired module.
- Theme-aware nested settings tabs, keyboard navigation, and reduced motion.
- Standard root-level stylesheet and independent installable release assets.
- MIT licensing and the standard fundingUrl support link.

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
