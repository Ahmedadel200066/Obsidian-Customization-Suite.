# Customization Studio 0.1.0

First packaged release for manual vault testing. This is not a Community
Plugins listing and has not been submitted to Obsidian.

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

Alternatively, extract `Customization-Studio.zip` into that plugin directory.
The ZIP has the three runtime files and the MIT license at its root. GitHub's
automatic source-code archives are not the installable ZIP.

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
