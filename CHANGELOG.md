# Changelog

## Unreleased

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
- Add a project report documenting implemented scope, limitations, and
  verification status.
