const SUPPORT_URL = "https://ko-fi.com/ahmedadel23545";

// One entry per released version. Add an entry when a version ships; a version without an entry updates silently.
const WHATS_NEW = {
  "1.4.0": {
    summary: "A clearer settings layout, easier control resets, and fixes for Kanban styling and saving.",
    highlights: [
      "Find controls under Appearance, Plugins, and Advanced, with a sticky toolbar and search for the current page.",
      "Start with Basics and open More settings when needed. Inherited and Modified labels show which standard controls you changed, with individual Reset buttons.",
      "Enjoy cleaner spacing, keyboard focus, and subtle motion that respects reduced-motion preferences.",
      "Settings use the available width, including maximized windows, and color swatches stay round when resizing.",
      "Kanban color and opacity changes now apply correctly from a neutral profile.",
      "Save settings without destination-file collisions, with recovery for valid interrupted-save journals."
    ]
  },
  "1.3.0": {
    summary: "A version-aware What's new dialog and more reliable scrolling in the ribbon settings modal.",
    highlights: [
      "See release highlights after an update, with no automatic dialog on a fresh install.",
      "Reopen these notes from the Show what's new command or settings button.",
      "Support development through the optional support button.",
      "Ribbon settings now keep their scroll area within the viewport, including when an older stylesheet is installed.",
      "Scroll bounds adapt when the window or mobile viewport changes."
    ]
  },
  "1.2.0": {
    summary: "Light and Dark profiles, a neutral Default profile, and nine card shapes for Obsidian Bases.",
    highlights: [
      "Neutral, editable Default profile created from your current appearance. Nothing changes until you adjust a setting.",
      "Follow Obsidian, Light, or Dark per profile, with separate Light and Dark values.",
      "Nine Bases card shapes with their own controls, artwork size, and optional Glow, Lift, Flip artwork, or Wiggle hover effects.",
      "Master Enabled/Paused switch. Changes apply instantly.",
      "Export and import now include both variants and shape settings.",
      "Fixed a repeating \"file already exists\" notice when saving settings."
    ]
  }
};

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
  return match ? match.slice(1).map(Number) : null;
}

function isNewerVersion(current, previous) {
  const a = parseVersion(current), b = parseVersion(previous);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// Returns "show", or "record" when the version should only be remembered silently.
function whatsNewAction({ freshInstall, lastSeenVersion, currentVersion, enabled = true, entries = WHATS_NEW }) {
  if (freshInstall) return "record";
  if (lastSeenVersion === currentVersion) return "none";
  if (lastSeenVersion && !isNewerVersion(currentVersion, lastSeenVersion)) return "record";
  if (!enabled || !entries[currentVersion]) return "record";
  return "show";
}

module.exports = { SUPPORT_URL, WHATS_NEW, isNewerVersion, whatsNewAction };
