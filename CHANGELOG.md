# Changelog

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

### Post-1.3.0 changes on main

- Keep CSS-variable consumers when a neutral profile overrides Kanban card color or opacity.
- Remove duplicate modal max-height declarations and stylesheet important rules while retaining runtime scroll protection.
- Add the phase-one compact sticky toolbar and Appearance / Plugins / Advanced layout, with responsive page/plugin dropdowns and current-page search.
- Preserve profile tools under Advanced and retain keyboard navigation.
- Replace rename-to-existing sidecar saves with atomic processing when available and overwrite-capable writes otherwise.
- Recover valid pending-save journals from interrupted saves or the older destination-exists error, while preserving existing settings and backups.
- Add regression coverage for save collisions, journal recovery, inherited variable consumers, and search state.

These changes do not alter the published 1.3.0 release assets. Basics/details grouping and per-control Inherited/Modified resets are not included in this phase.

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
