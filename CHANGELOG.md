# Changelog

## 1.4.0

### Added

- Compact sticky toolbar, Appearance / Plugins / Advanced navigation, responsive page/plugin dropdowns, and current-page search.
- Basics/details grouping with search-aware group restoration.
- Inherited / Modified labels and per-control Reset for standard global and plugin controls, with Profile default labels for preset or forced palettes where appropriate.
- Updated in-app release notes, with the optional Buy Me a Coffee support button retained.

### Changed

- Refined spacing, typography, hover and keyboard-focus states.
- Subtle panel, group and navigation motion respects reduced-motion preferences.

### Fixed

- Settings content collapsing into a narrow column in enlarged windows because native centering padding consumed the capped page width.
- Color swatches becoming oval: both the input and the native inner swatch now keep square dimensions.
- Neutral-profile Kanban color and opacity changes dropping their CSS-variable consumers.
- Destination-file collisions during sidecar saves. Atomic processing or overwrite-capable writes replace rename-to-existing operations.
- Recovery of valid interrupted-save journals, while preserving unrelated or corrupt data and backups.
- Retained ribbon modal scroll protection.

## 1.3.0

### Added

- Version-aware What's new dialog, shown once after an update and skipped on a fresh install.
- Show what's new command and settings button, plus a centered Buy Me a Coffee support button with an inline icon.

### Fixed

- Ribbon settings scrolling when an older installed stylesheet or conflicting theme rules hid overflow.
- Ribbon modal scroll bounds now use viewport-based runtime sizing and update on window or visual viewport resize.


## 1.2.0

### Added

- Neutral, editable Default profile created from the current appearance on first run.
- Create new profiles from Default; explicit Duplicate for presets.
- Follow Obsidian, Light, or Dark per profile, with separate Light and Dark values and paired preset palettes.
- Master Enabled/Paused toggle.
- Nine Bases card shapes (Standard, Book, Poster, Circle, Spine, Polaroid, Trading card, Disc, Ticket) with per-shape controls.
- Artwork size (50% to 150%) for every shape and optional Glow, Lift, Flip artwork, and Wiggle hover effects (default Off).
- Instant apply and live re-measurement of native card layouts.
- Export and import of both variants and shape settings; Legacy JSON export.
- `studio-appearance.json` with backup and interrupted-save recovery.

### Changed

- Refined the Book shape.

### Fixed

- Card text and metadata staying in front of the artwork.
- Repeating "EEXIST: file already exists" notice when saving `studio-appearance.json.bak`; a failed backup no longer blocks saving.

## Unreleased

### Earlier development notes

- Preserve successive Kanban column color edits and Clear actions in one settings view.
- Discover review dialogs and drag portals outside the main workspace.
- Apply and clean up module/profile styles independently in popout documents.
- Keep card and lane customization on body-mounted Kanban drag previews.
- Reject overlong profile names before rename can save invalid startup data.
- Add six regression tests and bug-fix verification notes.

- Build the self-contained Obsidian plugin bundle directly to repository-root
  `main.js`.
- Add a published-release workflow that runs tests, validates the bundle, and
  attaches a root-flat installable ZIP.
- Document root/manual installation, BRAT, development, compatibility limits,
  and contribution guidance.
- Add a ribbon shortcut for opening Customization Studio settings.
- Replace undocumented settings navigation with a plugin-owned settings modal
  that reuses the same UI and closes on unload.
- Improve active profile previews and switching feedback.
- Remove global corner-radius customization while migrating old profile data
  safely.
- Add tab-bar-only opacity and gradient controls, with immediate preview.
- Refresh the global appearance preview and color pickers after reset.
- Resolve Kanban background images from validated vault paths or HTTP(S) URLs.
- Assign distinct per-column DOM tokens to prevent independent colors from
  sharing a selector during reorder.
- Add independent Kanban card/column glow settings and reduced-motion-aware
  transitions.
- Add safe, opt-in Spaced Repetition and Bases diagnostics that log counts and
  styling metadata only.
- Add accessible tabbed settings navigation, per-surface persisted view state,
  active-profile status, and safe invalid-profile recovery.
- Add tab-bar transparency, backdrop blur, and linear/radial/circular gradient
  controls.
- Add a project report documenting implemented scope, limitations, and
  verification status.
