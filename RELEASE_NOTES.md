> Repository support link: [Support on Ko-fi](https://ko-fi.com/ahmedadel23545). This link change has not been released.

# Customization Studio 1.4.0

## What's new

- A compact sticky toolbar keeps the profile, appearance mode, master switch, and page search close at hand.
- Settings are grouped under **Appearance**, **Plugins**, and **Advanced**. Narrow panes use page and plugin dropdowns.
- Start with **Basics**, then open **More settings** for extra controls. Search temporarily opens matching groups and restores them when cleared.
- **Inherited** and **Modified** labels show the state of standard controls, with individual **Reset** buttons. Inherited values refer to the profile's stored baseline, not live theme measurements. Preset and forced-palette values use **Profile default** where appropriate.
- Cleaner spacing, hover and keyboard-focus states, plus subtle motion that respects reduced-motion preferences.
- The in-app **What's new** dialog and optional **Buy Me a Coffee** button remain available. Reopen the notes with the **Show what's new** command or the button under Advanced. Every feature stays free.

## Fixes

- Settings keep a readable width when the Settings window is enlarged or maximized. Color swatches stay round at different window sizes.
- Kanban card color and opacity overrides apply correctly from a neutral profile.
- Saving no longer tries to rename a temporary file onto an existing settings file. Valid pending-save journals can be recovered after an interrupted save or an older destination-file collision.
- Ribbon settings retain their viewport-aware scrolling protection.

## Installation and update

Download **main.js**, **manifest.json**, and **styles.css** from this release and replace all three files in your vault's `.obsidian/plugins/customization-studio/` folder. Disable and re-enable Customization Studio afterward, or restart Obsidian.

Minimum supported Obsidian version: **1.9.0**. Existing profiles and appearance settings are preserved. Do not delete settings, backups, or pending-save journals to update.

Support development, optionally: https://ko-fi.com/ahmedadel23545
