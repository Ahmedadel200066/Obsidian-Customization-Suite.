# Customization Studio

Customization Studio is a non-invasive Obsidian plugin foundation for styling
Obsidian and supported community plugins. It does not edit third-party plugin
source files or their settings. Profiles are persisted with Obsidian's plugin
data API; styles and CSS variables are removed when the plugin unloads.

## Features

- Five built-in profiles: Minimal, Dark Academia, Glassmorphism, Colorful, and
  Focus Mode.
- User-created profiles, copied from the active profile and stored in plugin
  data.
- Settings controls for accent, surface and text colors, and border radius.
- Profile-wide and per-module CSS editors with live preview.
- Independent toggles for Kanban, Bookshelf, Dataview, Calendar, Spaced
  Repetition, and Dashboard modules. Module CSS is injected only when its module
  is enabled and a configured target plugin ID is enabled.
- DOM-stable, Level 1 module boundaries only. No plugin DOM mutation,
  monkey-patching, storage writes, or canvas overrides are performed.

## Install for development

Copy this directory into `<vault>/.obsidian/plugins/customization-studio/` and
enable **Customization Studio** under Community plugins. The plugin uses plain
CommonJS JavaScript and requires no build step.

## CSS and compatibility

Profile-wide CSS is intentionally powerful and can affect any matching
selector. Module CSS is maintained separately per module and profile, but its
selectors must target that plugin's UI; verify selectors against the plugin
version in use. Modules are conservatively Level 1 and do not claim support for
dynamic DOM or canvas-rendered interfaces until those integrations are
implemented and tested.

The recognized target IDs are declared in `modules/`. If a community plugin
uses a different ID, update that module's `pluginIds` list after verifying the
plugin manifest. Core appearance values use Obsidian CSS variables and are
restored when Customization Studio unloads.
