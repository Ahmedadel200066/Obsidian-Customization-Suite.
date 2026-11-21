# Growth-change verification

## Scope

Prepared locally on a branch based on main commit `35e31e5`. This document does
not authorize a push, merge, release, directory submission, or policy acceptance.
The owner reviews the exact changes before a push.

- Added opt-in Tasks, Dataview, Calendar, and Day Planner integrations.
- Added theme-following palettes and concrete layout controls per integration.
- Preserved the existing Kanban, Spaced Repetition, and Bases modules.
- Added two-level animated tab indicators, keyboard focus preservation,
  reduced-motion handling, narrow-screen scrolling, and resize cleanup.
- Distributed standard root-level styles.css and independent release assets.
- Added the verified fundingUrl, README support link, and text-only settings
  footer. The footer has no donation button or outgoing support link.
- Added MIT licensing, copyright 2026 Ahmed Adel, and the notice to main.js.
- Added the chosen README banner and current publishing checklist.

## Automated checks

`npm ci`, `npm run build`, and `npm test` pass. **47 tests pass.**

Coverage includes:
- Existing profile persistence, import validation, module styling, Kanban
  column-color changes, drag portals, review-modal discovery, and popouts.
- Loading root styles.css using manifest.dir, including a renamed installation
  directory, with a vault-config-directory fallback.
- Opt-in defaults and independent new-module settings surviving a reload.
- All four new controllers discovering roots in main and secondary documents,
  owning their styles, and removing styles/observers when disabled.
- Range, color, and scoped-CSS validation; theme-variable defaults.
- No Day Planner time-position/duration or per-event-color token overrides.
- Root stylesheet/source equality, standalone compiled imports, MIT notice,
  verified funding destination, and individual release-asset upload command.

CSS watch-mode was smoke-tested: changing the source triggered a rebuild and
updated the generated stylesheet; the original source was restored afterward.

A runtime-only ZIP was created and unpacked. It contains only main.js,
manifest.json, styles.css, and LICENSE. The compiled plugin class loads from
that isolated directory with only Obsidian's host API stubbed. This establishes
that no local source folders or node_modules are needed to load the bundle;
it does not establish real-host startup or installed-plugin compatibility.

## Browser checks

The settings view was rendered from the actual changed code with browser
stand-ins for Obsidian's host controls. Integration styling used sample DOM
fixtures based on inspected upstream hooks. This is **not a live Obsidian
vault** and the images say so.

Checked dark/light presentation, all seven integration tabs, keyboard
ArrowRight/End navigation, four injected integration styles, and Day Planner
radius/font changes. At 390px, the page has no horizontal overflow; only the
integration tab strip scrolls. The active tab and underline remain visible and
aligned after resizing. Reduced-motion mode produces no UI animations. All
four module styles disappear on disable, and no browser page errors occurred.
The text-only footer and absence of footer links/buttons were also checked.

A first visual pass caught the active narrow-screen tab being offscreen after
resizing. The resize handler was fixed and the updated pixels were inspected.

## Source versions and remaining manual checks

Source inspected:
- Calendar 1.5.10, `ef3f269`:
  https://github.com/liamcain/obsidian-calendar-plugin
- Dataview 0.5.68, `5ad0994`:
  https://github.com/blacksmithgu/obsidian-dataview
- Tasks 8.6.0, `9fecdd6` (requires Obsidian 1.13.1):
  https://github.com/obsidian-tasks-group/obsidian-tasks
- Day Planner 0.35.1, `9c483b3`:
  https://github.com/ivan-lednev/obsidian-day-planner

Before claiming release readiness:
1. Install only the standard runtime files in a disposable real vault.
2. Confirm Obsidian loads core styling, opens settings, and cleans up on unload.
3. Duplicate a built-in profile, enable each new integration, and confirm its
   controls update the installed target. Existing profiles must keep new
   integrations off unless explicitly enabled.
4. Check Calendar today/weekend/daily-note clicks; Dataview table links, lists,
   inline fields, and that unrelated Markdown tables are unaffected.
5. Check Tasks status/priority colors, date clicks, query groups, and opening
   and submitting a task edit form added after startup.
6. Check Day Planner drag/resize, short blocks, completion states, colored
   events, weekly view, and time tracker. Appearance CSS must not change time
   semantics or hide native controls. No native drag/resize was simulated.
7. Repeat in popouts, mobile, light/dark themes, and reduced-motion mode.
8. Test settings persistence after restart, profile export/import, and all
   module-disable/plugin-unload cleanup.
9. Run the real release workflow only after approval, then test downloaded
   release assets. Local archive checks do not verify GitHub upload success.
10. Capture real Obsidian screenshots before replacing the clearly marked
    interface-preview banner or claiming in-app screenshots.
