# Customization Studio 0.1.1

Patch release for scan findings and safer integration handling. This is not
a Community Plugins listing and has not been submitted to Obsidian.

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

## Changes since 0.1.0

- Removed the host application's name from the manifest description to meet
  the directory scan rule.
- Kept active-tab fallback colors without duplicate background declarations.
- Added GitHub build provenance attestations for the three runtime assets.
- Removed the optional ZIP and separate LICENSE from future release uploads.
- Clarified external images, imported CSS, and user-clicked clipboard export
  in the privacy documentation. No backend or analytics was added.
- Updated settings headings to the host API and sentence case.
- Guarded plugin discovery and normalized vault-relative plugin/CSS paths.

Published 0.1.0 assets and its tag are unchanged. This release does not imply
that the directory review passed or that manual vault testing is complete.

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
