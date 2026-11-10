# Customization Studio Project Report

## Status

Customization Studio is a modular Obsidian appearance plugin scoped to three
V1 integrations: Kanban, Spaced Repetition, and Obsidian Bases. The project
builds a self-contained root-level `main.js` for installation. Automated
Node.js tests pass, but the plugin has not been run inside a real Obsidian
vault; live compatibility is not certified.

## Features

### Global and profile controls

- Five built-in profiles: Minimal, Dark Academia, Glassmorphism, Colorful, and
  Focus Mode.
- Custom profile creation, duplication, rename, delete, import, export, and
  switching.
- Profile-level accent, surface, text, tab-bar opacity/gradient, custom CSS,
  module enablement, and independent module settings.
- Visual controls, collapsible sections, active-profile preview, immediate
  style updates, and debounced settings persistence.
- Shared settings UI in both the Obsidian plugin settings tab and a
  plugin-owned modal opened by the ribbon shortcut.

### Kanban

- Automatic column coloring and manual overrides for currently detected
  columns; column and card colors and opacity.
- Independent column/card radius, spacing, and padding.
- Column blur, card and column glow, hover lift, reduced-motion-aware
  transitions, and configurable drag-state visuals.
- Board background from a validated vault-relative path or HTTP(S) URL, with
  image opacity, overlay, sizing, and position options.
- Dynamic DOM observation supports newly mounted columns/cards. Styles and
  temporary DOM markers are removed on module disable/unload.
- Manual overrides are keyed by visible title. Duplicate titles are
  ambiguous, and title-based overrides do not follow renamed columns.
- Kanban 2.0.51 source selectors were inspected; installed-version rendering
  and drag/drop behavior are not live-verified.

### Spaced Repetition

- Flashcard background, border, radius, shadow, padding, and spacing.
- Shared question/answer typography, answer/review-area presentation, review
  button colors and sizing, and transition effects.
- Optional diagnostics report detection and element counts, not card text.
- Selectors were checked against Spaced Repetition 1.15.4 source; live study
  behavior is not verified. The inspected markup has no verified separate
  question/answer containers or progress indicator, so those controls are not
  claimed or exposed.

### Obsidian Bases

- Table and gallery/card controls implemented through documented native
  `--bases-table-*` and `--bases-cards-*` CSS variables.
- Bases detection uses Obsidian's core-plugin API.
- Optional diagnostics report matched-view counts and applied variable names.
- Requires Obsidian 1.9.0 or later. Unsupported card-radius, cover-position,
  property-visibility, and responsive-grid controls are omitted rather than
  simulated with unverified selectors.

## Architecture

- `src/main.js` coordinates startup, settings, profiles, themes, and module
  lifecycle.
- `core/` contains persistence, profile validation/management, CSS injection,
  module management, and settings UI.
- `modules/<id>/` contains each module's contract, settings schema, selectors,
  controller/observer, and generated CSS.
- `profiles/` contains built-in JSON profile data; user data is saved through
  Obsidian's plugin data API.
- esbuild bundles local CommonJS modules from `src/main.js` to root `main.js`;
  `obsidian` remains an external host API. `manifest.json` and `styles/` are
  alongside that bundle at install time.
- Module styles and DOM state are plugin-owned. Disabling a module or
  unloading the plugin removes only this plugin's effects.

## Fixes and safeguards

- Bundling fixes the former unresolved local `require()` startup failure.
- Missing optional core CSS warns without blocking plugin startup.
- Community plugins and Bases core-plugin detection use their corresponding
  APIs.
- Profile imports validate data and receive unique IDs, including repeated
  imports.
- Settings writes are debounced and flushed during unload; errors are
  surfaced in the console and through Obsidian notices.
- Module lifecycle cleanup removes owned styles/observers and avoids deleting
  third-party DOM or style nodes.
- Kanban background inputs reject unsafe schemes and paths outside the vault.
- The ribbon shortcut uses a plugin-owned modal rather than Obsidian's
  undocumented settings-navigation API.

## Known issues and unverified behavior

- No real Obsidian vault or installed target plugins were available. Visual
  results, theme compatibility, restart persistence in Obsidian, and native
  Kanban/review interactions still require manual validation.
- Inspected plugin source versions may differ from a user's installed
  versions. Kanban DOM selectors and Spaced Repetition review selectors are
  version-sensitive.
- Bases behavior is based on documented CSS variables and API detection, but
  has not been exercised in a live Bases view.
- Kanban per-column override matching is title-based and cannot distinguish
  duplicate column names or preserve overrides across renames.
- Remote image availability is not checked. Local image paths must resolve to
  a file in the vault.
- Profile-wide CSS is intentionally powerful and can affect other matching
  Obsidian elements; module CSS is scoped and rejects global at-rules such as
  `@import`.
- There is no `LICENSE` file yet.

## Build and verification

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm run build
npm test
```

`npm run build` writes the installable bundle to root `main.js`; `npm run dev`
rebuilds it in watch mode. The bundle check rejects unresolved local imports
and validates the manifest and core stylesheet.

Latest validation: `npm ci`, `npm run build`, `npm test` (22 tests), and
`git diff --check` passed. These checks use automated tests and do not replace
testing in Obsidian.

## Installation

Copy the contents of the project root (or the contents of the flat
installable release ZIP) into:

```text
<vault>/.obsidian/plugins/customization-studio/
```

The destination must directly contain `main.js`, `manifest.json`, and
`styles/`. Enable Customization Studio under **Settings → Community plugins**.
