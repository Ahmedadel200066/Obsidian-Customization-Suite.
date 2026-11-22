# Local test build: Default, appearance variants, and shape controls

Build date: 22 November 2026. Shipped as version **1.2.0**; this file documents the local test build it came from.

## Install safely

1. Back up the plugin's existing `main.js` and `data.json`. Also back up `studio-appearance.json` and its `.bak` if they already exist.
2. Replace only `main.js`. `main.js.txt` contains the identical bytes; rename it to `main.js` if that is the file you download.
3. Keep the existing `manifest.json` and `styles.css`. Disable and re-enable the plugin once to load the new code. After that, settings changes apply without a manual view refresh.

## What changed

- First use creates and selects an editable **Default** profile. It inherits your current theme and snippets without imposing a dark palette. Existing profiles are kept. Once initialized, later profile choices are remembered.
- **Create from Default** always copies that template, even when a preset is selected. To copy a preset instead, open **Manage profile > Duplicate**.
- Below the profile picker, **Appearance** offers **Follow Obsidian / system**, **Light**, and **Dark**. Global and integration settings have separate Light/Dark values. Shape options are shared within each profile.
- Under **Integrations > Obsidian Bases > Cards and gallery**, choose a shape. Its own controls appear immediately below it. Every shape has size and an optional additional hover effect. Book has depth and page-edge controls; Disc has protrusion and diameter; the other shapes have their own border, crop, tilt, sheen, or notch controls.
- New additional hover effects start at **Off**: Glow, Lift, Flip artwork, and Wiggle. Motion is disabled for reduced motion and touch. Spine's separate reveal control retains its existing keyboard/touch behavior.
- Sizes use native card layout, so the artwork and grid can change size while text keeps its native font and positioning. A larger size can change the number of columns.
- Controls update the current layout without reloading the vault. Valid text/CSS edits apply as you type; pending text edits are saved when the plugin unloads.
- Resetting a neutral profile's controls does not apply Minimal's dark defaults. Untouched integration controls inherit native styling rather than applying a whole preset.
- Exported profiles now include both variants and shape settings. **Legacy JSON** exports only the current look, without the other variant or new shape options.

## Targeting and storage

Shape edits use the active Bases cards pane, or the sole visible cards pane. If the choice is ambiguous, select **Temporary shape target**. It is still a session/pane preview, not a saved-view rule. After restart, profile changes, reopening a view, or an unrelated cards-layout replacement, select the target again. This does not require reloading the vault.

Default preserves external themes and snippets by inheritance. It does not turn every third-party CSS rule into an editable control.

New settings live in `studio-appearance.json`, with a `.bak` and an interrupted-save recovery record. `data.json` remains readable by the published 0.1.1 loader. Keep matching settings files together when restoring backups. If you revert to an older build and edit its settings, restore a matching backup before returning to this build; do not mix an old `data.json` with an unrelated appearance file. If no appearance file existed before testing, move the newly created appearance files aside when restoring that old backup.

## Verification

- 86 automated Node tests.
- 216 native-CSS regression cases covering nine shapes, three widths, four cover ratios, Light/Dark, English/Arabic metadata, and missing covers.
- 90 new shape-size/control-extreme and hover-option cases, plus 45 cases with hover effects actively running. Metadata stayed inside the native cards and frontmost.
- First-run/migration neutrality, Default copying, separate variants, export/import, backup and interrupted-save recovery, live sizing, native group replacement, pause/unload restoration, reduced motion, touch fallback, secondary-window cleanup, and mobile overflow checks.
- Inspected rendered Book/Disc controls and Light/Dark screenshots.

The browser checks use actual Obsidian 1.15.1 CSS with a simulated host and native-style card positioning. They are not a test in your real vault. Your vault remains the final check before any push or release.

No commit, push, merge, tag, release, or version bump is included.
