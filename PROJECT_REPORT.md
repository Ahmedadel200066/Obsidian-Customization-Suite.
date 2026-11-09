# Customization Studio — Project Report

## 1. Executive summary

Customization Studio is a non-invasive Obsidian plugin for appearance
customization. Version 1 is intentionally limited to three integrations:

1. Kanban
2. Spaced Repetition
3. Obsidian Bases

The project has a modular CommonJS source architecture, profile persistence,
visual controls, plugin-specific controllers, and an esbuild packaging step.
The packaged plugin is produced in `dist/`; it is not the unbundled source tree.

The build and automated tests have been run successfully. The plugin has **not**
been tested inside a live Obsidian vault in this environment, so actual visual
compatibility, persistence through an Obsidian restart, and interaction with
installed plugin versions remain to be confirmed there.

## 2. Project goals and non-goals

### Goals

- Customize supported plugin and native Bases appearance without editing their
  source code, settings, or user content.
- Provide editable profiles, immediate style preview, and automatic persistence.
- Keep each integration independent so future modules can be added without
  replacing the core architecture.
- Inject only plugin-owned styles and clean those styles up during disable or
  unload.

### Non-goals

- Changing Kanban data or native drag-and-drop behavior.
- Changing Spaced Repetition scheduling, review state, or study data.
- Editing Bases definitions or user data.
- Shipping integrations or placeholder settings for other community plugins.
- Claiming live compatibility based only on source inspection or mock tests.

## 3. Supported features

### Global appearance

Custom profiles can set:

- Accent color.
- Surface color.
- Text color.
- Interface corner radius.
- Optional profile-wide custom CSS.

Global theme values are applied with a plugin-owned stylesheet and body state.
The engine restores its original class/data state and removes its own style
elements on unload.

### Kanban

The settings UI exposes:

- Automatic column colors based on recognized column names and manual per-column
  color overrides.
- Default column and card colors and independent opacity.
- Independent column/card corner radius, spacing, and padding.
- Column blur.
- Board background image URL, opacity, overlay color/opacity, size, and
  position.
- Card hover glow and lift options with glow intensity.
- Visual drag-state styles: lift, glow, ghost, outline, and smooth.
- Optional module-scoped custom CSS.

The controller reads column titles, updates new columns through a scoped
observer, and adds a temporary marker only to color-matched columns. It records
the previous marker value and restores it only while the marker still contains
the value written by this plugin. Styling does not wrap native drag handlers.

The selectors were checked against the upstream Kanban 2.0.51 source. The
installed user's version and live drag behavior have not been verified.

### Spaced Repetition

The settings UI exposes:

- Flashcard background, border color, radius, shadow, padding, and spacing.
- Shared question/answer content color, size, and weight.
- Review controls background and padding.
- Show-answer and Again/Hard/Good/Easy button colors.
- Button radius, height, spacing, hover/focus/disabled appearance, and
  transition duration.
- Review status colors where corresponding source classes are present.
- Optional module-scoped custom CSS.

Selectors were checked against upstream Spaced Repetition 1.15.4 source. The
inspected source exposes a shared `.sr-content` region rather than separate
question and answer containers. Consequently, text typography applies to the
shared content. No progress indicator control is provided because a suitable
selector was not verified. Live review interaction is untested.

### Obsidian Bases

The module uses documented native Bases CSS variables for:

- Table text size, row height, min/max column widths, borders, and container
  radius.
- Table header colors/weight/icon display and hover state.
- Table row hover, active-cell radius/background, and disabled-cell background.
- Cards/gallery container and card background, cover background, scale, group
  spacing, line height, border width, and shadow states.
- Optional module-scoped custom CSS.

Bases is detected through Obsidian's core plugin API, not only the community
plugin registry. Unsupported controls for card radius, cover positioning,
property visibility, or a specific responsive-grid selector were omitted
rather than fabricated. Bases rendering has not been tested in an Obsidian
window.

### Profiles and settings

- Five built-in profiles: Minimal, Dark Academia, Glassmorphism, Colorful, and
  Focus Mode.
- Built-in profiles are copied before editing.
- Custom profiles support create, duplicate, rename, delete, import, export,
  and switching.
- Profiles store global variables, independent module enablement and settings,
  and optional custom CSS.
- Imported profiles are validated and assigned unique IDs.
- Legacy CSS for removed integrations is preserved as inactive data but is not
  injected.
- Settings are written through Obsidian's `loadData()`/`saveData()` APIs.
  Writes are debounced and pending state is flushed during unload.

The Settings tab groups controls into collapsible sections, uses color pickers,
sliders, toggles, dropdowns, and text inputs, and previews changes as they are
made. Advanced CSS editors are optional rather than the primary customization
interface.

## 4. Architecture and important files

| Path | Responsibility |
|---|---|
| `src/main.js` | Plugin startup, lifecycle, error reporting, cleanup, and top-level apply/save. |
| `build.mjs` | esbuild bundle, local-import checks, watch mode, and distribution packaging. |
| `core/settings-manager.js` | Settings validation, debounced persistence, flush queue, and save waiters. |
| `core/profile-manager.js` | Built-in/custom profile lifecycle, migration, import/export, ID uniqueness, validation. |
| `core/theme-engine.js` | Global variables, optional core CSS loading, owned style elements, unload cleanup. |
| `core/module-manager.js` | Module registration, target detection, refresh, lifecycle and teardown. |
| `core/settings-tab.js` | Profile, global appearance, module controls, and advanced CSS UI. |
| `modules/index.js` | Registry of the three V1 modules. |
| `modules/base-controller.js` | Shared module view-root discovery and observer lifecycle. |
| `modules/settings-utils.js` | Shared defaults, validation, and CSS color utilities. |
| `modules/css-scope.js` | Scope checks and restrictions for optional module CSS. |
| `modules/kanban/` | Kanban selectors, settings schema, controller, and generated CSS. |
| `modules/spaced-repetition/` | Spaced Repetition selectors, settings schema, controller, and generated CSS. |
| `modules/bases/` | Bases selectors, settings schema, controller, and generated CSS variables. |
| `profiles/` | Five built-in profile JSON objects bundled into the application. |
| `styles/core.css` | Settings UI and shared plugin styling, copied into the distribution. |
| `tests/core.test.js` | Core persistence, profiles, detection, cleanup, and module fixture tests. |
| `tests/settings-ui.test.js` | Mocked Settings UI control rendering, preview, and persistence test. |
| `manifest.json` | Obsidian plugin ID, version, minimum app version, and metadata. |
| `package.json` / `package-lock.json` | Build/test scripts and locked esbuild development dependency. |

## 5. Packaging and installation

Obsidian expects the conventional `main.js` entry point to be available beside
the manifest. The source entry point is kept separately at `src/main.js`.
`build.mjs` bundles the local modules and JSON profiles into `dist/main.js`,
leaves the `obsidian` host API external, then copies the manifest and `styles/`
into `dist/`. The build rejects unresolved relative `require()` calls.

Build and test:

```sh
npm ci
npm run build
npm test
```

For watch mode:

```sh
npm run dev
```

Install the **contents of `dist/`** directly into:

```text
<vault>/.obsidian/plugins/customization-studio/
```

Enable the plugin in Obsidian's Community plugins settings. Obsidian 1.9.0 or
later is required for Bases. If optional `styles/core.css` cannot be read, the
plugin reports a warning and continues without that stylesheet.

Generated `dist/` and intermediate `.build/` files are ignored by Git. Keep the
modular source files; do not install the unbundled source tree.

## 6. Issues found and fixes recorded

### Resolved: plugin startup could not resolve local modules

The previous installation entry point used local CommonJS imports such as
`require("./core/settings-manager")`. Since the installed directory did not
contain a CommonJS runtime resolver or the expected source tree, Obsidian
reported `Cannot find module './core/settings-manager'`.

**Fix:** Moved the source entry point to `src/main.js`, added esbuild and a
packaging workflow, and generate a self-contained `dist/main.js`. The build
keeps only the Obsidian host API external and checks for unresolved local
imports. Installation instructions now point to `dist/`.

### Other core fixes present in this implementation

- Community plugins and Bases use their respective detection APIs.
- Profile import IDs are made unique; loaded/imported profile data is validated.
- Settings writes are debounced, queued, and flushed during unload.
- Optional core stylesheet read failures warn the user but do not prevent
  startup.
- Injected styles are owned and removed safely; Kanban column markers are
  restored only if still owned by this plugin.
- The V1 registry includes only Kanban, Spaced Repetition, and Bases. Legacy
  settings for removed modules are retained as inactive data and not applied.
- Startup errors are logged/notified and are not silently swallowed.

## 7. Known limitations and outstanding verification

- No live Obsidian vault or installed target plugins were available during
  development. The packaged entry smoke test uses a stubbed Obsidian API; it
  does not prove that the plugin loads or renders correctly in Obsidian.
- Source selectors were checked against the upstream versions documented in
  `README.md`, not the specific versions installed in an end-user vault.
- Theme compatibility, restart persistence in a real vault, profile switching
  in the UI, disabling/removing styles during live use, and Kanban's native
  drag-and-drop/review behavior still require manual Obsidian testing.
- CSS custom properties and selectors can change between Obsidian/plugin
  versions or be overridden by themes.
- Advanced custom CSS is intentionally powerful. Module CSS is scoped and
  rejects global at-rules such as `@import`; users should still enter only CSS
  they trust. Profile-wide CSS is intentionally global and is not sandboxed.
- The Settings UI's export action requires clipboard access. If the clipboard
  API is unavailable, the UI reports an error rather than showing success.
- Several requested visual details are not implemented where no stable,
  documented hook was verified. In particular: separate Spaced Repetition
  question/answer styling and progress bars; Bases card radius, cover image
  positioning/sizing, property visibility, and dedicated responsive-grid
  controls.

## 8. Validation record

Last recorded build validation:

- `npm ci` — passed.
- `npm run build` — passed and packaged `dist/`.
- `npm test` — 14 tests passed, 0 failed.
- JavaScript syntax checks — passed.
- Packaged bundle inspection — no unresolved local `require()` calls; only
  `require("obsidian")` remains.
- Packaged entry smoke test with a stubbed Obsidian host API — passed.
- Distribution layout check — `main.js`, `manifest.json`, and `styles/` are
  colocated.
- `git diff --check` — passed.

These are source/build checks, not a live Obsidian compatibility certification.

## 9. Upstream references

- Kanban source: <https://github.com/community-archive/obsidian-kanban>
  (inspected version 2.0.51; manifest ID `obsidian-kanban`).
- Spaced Repetition source: <https://github.com/st3v3nmw/obsidian-spaced-repetition>
  (inspected version 1.15.4; manifest ID `obsidian-spaced-repetition`).
- Obsidian Bases CSS variables:
  <https://github.com/obsidianmd/obsidian-developer-docs/blob/1c26772ac13d6e9870c865936d389fdfe694e742/en/Reference/CSS%20variables/Editor/Bases.md>.
