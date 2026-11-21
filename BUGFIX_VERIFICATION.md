# Bug-fix verification

Base revision: `e9f1c4a1b79f87632f64ad9a2247eaa2e23e4f7a`.

## Changes in this patch

- Per-column Kanban color and Clear callbacks read the latest profile map. Editing a second column no longer replaces an earlier edit from the same settings screen.
- Module roots are discovered in each workspace document, not just inside the main workspace element. A shared, filtered observer discovers late-mounted review dialogs and drag portals without waiting for a layout-change event.
- Module CSS is owned per document. An isolated popout receives styles even if no matching view is open in the main window. Window-close, module-disable and unload remove owned styles and observers.
- Global profile CSS, variables and settings CSS also follow popout documents and are removed when the document closes or the plugin unloads.
- Kanban drag portals are included in root detection and card/lane styling. Board wallpaper stays on the board, rather than being applied to the drag portal.
- Profile rename rejects names longer than 100 characters before saving; create/rename inputs use the same maximum length.
- Rebuilt root `main.js` is included so source and installable code match.

## Automated checks

`npm test`: 31 passing tests, including six new regression tests:

1. Successive column color changes and Clear preserve other column edits.
2. Overlong rename is rejected and a valid 100-character name survives save/reload.
3. A review modal added outside the workspace is discovered without a layout event; removing it removes its module stylesheet.
4. Kanban and Bases styles apply in an isolated popout; changing Bases scale updates it and disabling the module removes its CSS.
5. Generated drag-card rules match a body-mounted portal outside the board root.
6. Window-open/window-close discovery and cleanup handle a stale leaf list.

`npm run build` and `git diff --check` also pass.

An additional local Chromium fixture used real DOM, MutationObserver and computed CSS to check independent lane colors, a late-mounted review dialog, a body-mounted dragged card, a separate iframe document, live Bases scale-variable changes and cleanup. This is a fixture, not the Obsidian application or a real target-plugin session.

## Existing behavior not changed by this patch

- Tabbed settings navigation, active-profile badges/swatches, global-reset preview refresh, per-surface navigation persistence, circular gradients, blur controls, local/remote backgrounds and module enable/disable already exist in the base revision.
- Profile suggestions, integration context menus, per-card right-click colors and extra Bases card shapes are not implemented here. They need a separate design and verified target-plugin hooks. No donation destination is invented.
- Presets remain the existing color palettes; this patch does not redesign them.
- Release/BRAT packaging is not changed.

## Required checks in a test vault

Use a backup or throwaway vault. No note contents or scheduling data should change.

1. Open Kanban 2.0.51, create two differently colored columns from one settings screen, then clear one color. Confirm the other stays unchanged.
2. Drag cards and entire columns. Confirm colors remain during pickup, movement, drop and reorder. Repeat with reduced-motion enabled.
3. Move the only Kanban board to a popout. Confirm styles work without another board open in the main window. Change profile and settings, close the popout, then disable/unload the plugin.
4. Open a Spaced Repetition 1.15.4 review modal after startup, with no pre-existing review tab. Verify colors, buttons and keyboard review behavior. Repeat in a popout and on mobile if used.
5. In real Bases table/cards views, change settings including card scale. Disable the module, then disable the plugin; verify all plugin-owned appearance changes disappear. This patch only verifies CSS lifecycle and cannot certify every native Bases variable against every Obsidian version.
6. Check tab-bar transparency against the actual parent/background and theme. A transparent header does not itself make the Obsidian window transparent to the desktop.
7. Reopen both settings surfaces and restart Obsidian to verify navigation/scroll persistence, reset previews and modal dimensions under the installed theme.

These checks remain open. Passing source tests or the Chromium fixture must not be described as passing them.
