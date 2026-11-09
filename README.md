# Customization Studio

Customization Studio is a non-invasive Obsidian plugin for visual profiles and
three V1 module integrations: Kanban, Spaced Repetition, and Obsidian Bases. It
does not edit third-party plugin files, Base definitions, review scheduling, or
user data.

## V1 module scope

Only these modules are registered:

- **Kanban** — controls for column/card colors, background opacity, radii,
  spacing, padding, blur, background image layers, hover appearance, per-column
  color overrides, and visual drag states. Column names and card/drag selectors
  are based on the Kanban 2.0.51 source stylesheet and component classes.
- **Spaced Repetition** — flashcard surface, border, radius, shadow, padding,
  shared question/answer typography, review area spacing, show-answer and review
  button colors/states, and review status colors. Selectors are based on the
  Spaced Repetition 1.15.4 source styles and button classes.
- **Obsidian Bases** — table and cards-view settings written through the native
  CSS variables listed in Obsidian's Bases CSS variable reference. Bases is
  detected through `app.internalPlugins`, not the community plugin registry.

Each module owns its settings schema, target detection metadata, selectors,
controller, observer lifecycle, and generated CSS. Add future modules to
`modules/` and `modules/index.js`; no other modules are part of V1.

## Profiles and settings

- Five built-in profiles: Minimal, Dark Academia, Glassmorphism, Colorful, and
  Focus Mode. Duplicate a built-in profile to edit it.
- Custom profiles support create, duplicate, rename, delete, import, and export.
- Each profile stores global variables, independent module enablement, and
  module-specific settings.
- Setting changes preview immediately and persistence is debounced. Pending
  changes are flushed during plugin unload.
- Existing module CSS from older versions is migrated. CSS belonging to modules
  outside V1 is preserved in `inactiveModuleCss` but is not injected.
- Optional module CSS is scoped under the module root. `@import`, keyframes,
  and other global at-rules are rejected.

## Installation

The Obsidian plugin directory must be named after the manifest ID:

1. Build the distributable package:

   ```sh
   npm ci
   npm run build
   ```

2. Copy the **contents of `dist/`** into
   `<vault>/.obsidian/plugins/customization-studio/`.
3. Verify the generated `main.js`, `manifest.json`, and `styles/` are directly
   inside that folder, not nested one level deeper.
4. Enable **Customization Studio** under Community plugins.

Obsidian loads the conventional `main.js` entry point. The build bundles the
modular source tree into `dist/main.js` and keeps `obsidian` external for host
API access. Profiles are bundled into the output; the package step copies the
manifest and styles alongside it. Do not install the unbundled source tree.

For development, run `npm run dev` to watch source changes and refresh the
package in `dist/`. Install `dist/` into a test vault to exercise the plugin.
The source entry point is `src/main.js`; its modular imports remain in `core/`,
`modules/`, and `profiles/`.

The `styles/core.css` loader reads
`<vault>/.obsidian/plugins/customization-studio/styles/core.css`. If that
optional file is missing, the plugin shows a warning and continues loading.
Obsidian 1.9.0 or later is required for Bases.

Run the automated tests from this repository with:

```sh
npm test
```

## Verification limits

No Obsidian vault or installed target plugins were available in the development
environment. Automated tests use DOM fixtures matching verified upstream class
names; they do not prove that the visual result works in a live Obsidian window,
survives an actual Obsidian restart, or preserves native drag/review behavior.
Kanban and Spaced Repetition selectors were checked against the upstream source
versions above, but not against a user's installed versions.

Bases controls use the documented variables
`--bases-table-*` and `--bases-cards-*`. The native CSS variable reference does
not document card radius, cover sizing/position, property visibility, or a
specific responsive grid selector; those controls have not been fabricated.
Actual Bases rendering remains unverified until tested in Obsidian.

Likewise, the Spaced Repetition interface exposes the shared `.sr-content` area,
not separate question/answer text containers or a verified progress-bar
selector. Text styling therefore applies to the shared content, and progress
styling is not provided.

## Architecture notes

- Target plugins are detected without mutating their settings. Bases detection
  uses `app.internalPlugins.getPluginById("bases")?.enabled` when available.
- Controllers observe only their matching view roots and disconnect when a
  module is disabled, its target becomes unavailable, or the plugin unloads.
- Every injected style element is created and removed by this plugin. Kanban's
  temporary column marker is restored only if its value is still the value this
  plugin wrote.
- Kanban drag styles affect only the plugin's visual drag container and dropping
  lane; no native drag handlers, transforms, or scheduling logic are wrapped.
- Theme-sensitive global variables are set through a plugin-owned stylesheet
  and restored by removing that stylesheet.

## Upstream references

- [Kanban source](https://github.com/community-archive/obsidian-kanban), manifest
  ID `obsidian-kanban`, version 2.0.51.
- [Spaced Repetition source](https://github.com/st3v3nmw/obsidian-spaced-repetition),
  manifest ID `obsidian-spaced-repetition`, version 1.15.4.
- [Bases CSS variables](https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/CSS%20variables/Editor/Bases.md).
