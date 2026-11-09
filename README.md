# Customization Studio

  Customization Studio is a non-invasive Obsidian plugin platform focused on the
  initial Version 1.0 scope: Kanban, Spaced Repetition, and Obsidian Bases.
  The plugin does not edit third-party plugin source files or their settings.
  Profiles are stored through Obsidian's plugin data API, and all injected styles are
  removed on unload.

  ## Version 1.0 scope

  - Kanban
  - Spaced Repetition
  - Obsidian Bases

  Other modules remain intentionally excluded from the current implementation scope.
  The core engine is modular and extensible so additional modules can be added later
  without redesigning the architecture.

  ## Features

  - Five built-in profiles: Minimal, Dark Academia, Glassmorphism, Colorful, and
    Focus Mode.
  - User-created profiles with JSON import and export.
  - Global appearance controls for accent, surface, text, and radius variables.
  - Profile-wide CSS and per-module CSS editors with live updates.
  - Independent toggles for the three supported modules only.
  - Safe CSS injection and cleanup with automatic removal on unload.
  - DOM-stable, Level 1 module boundaries only.

  ## Install for development

  Copy this directory into `<vault>/.obsidian/plugins/customization-studio/` and
  enable **Customization Studio** under Community plugins. The plugin uses plain
  CommonJS JavaScript and requires no build step.

  ## Compatibility

  Module CSS is intentionally scoped to stable selectors and verified plugin IDs.
  The active module registry is defined in `modules/index.js`, and each module's
  `pluginIds` list can be updated after checking the target plugin manifest. The
  core engine remains compatible with different Obsidian themes and versions by
  using CSS variables and safe style injection rather than modifying plugin source
  files.
