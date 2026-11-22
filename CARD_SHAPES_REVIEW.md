# Card shapes, local review only

This change has not been pushed, tagged or released. Manifest version remains
0.1.1. The current local build includes Light/Dark variants and per-shape controls; Kanban-menu work remains excluded. See LOCAL_TEST_BUILD.md for installation and backup notes.

## What is implemented

In a custom profile, under Integrations > Obsidian Bases > Cards and gallery:

1. Choose Standard, Book, Poster, Circle, Spine, Polaroid, Trading card, Disc,
   or Ticket. Standard is the default and emits no shape CSS until its size or additional hover effect is changed.
2. Shape edits use the active Bases cards pane, or the sole visible cards pane. If ambiguous, choose a pane under Temporary shape target.
3. Set the target to None to remove its shape effects. Standard at size 100% with hover Off is unchanged native artwork.

The target is a temporary live pane/root, not a persistent saved-view rule.
It is not serialized into profile JSON or data.json. It clears on profile
switch, master pause, disable, unload, pane/root removal or replacement of the observed
cards group. If a host reuses the same root and cards group for a different
saved view, that change is not identifiable through this DOM-only target.
Clear the target before switching saved views. Do not present this as durable
per-view targeting. Persistent scope remains a separate decision and requires
verified file/view identity. There is no profile-wide activation fallback.

Book and Poster keep artwork contained. Circle crops artwork only. Spine
keeps the native grid spacing stable: it does not turn the entire grid into
a new dense bookshelf layout. Hover or focus reveals a spine's cover; touch
keeps covers open. Polaroid adds a print border without changing title styling.
Trading card has static sheen, not a continuous animation. Disc adds a record
behind square artwork. Ticket adds side notches and perforation. Text and
properties are not moved into cover layers. Decorations do not intercept
pointer events. No note contents, cover URLs, ratings, authors or states are
changed. No fonts or artwork are downloaded by these effects.

## Verification and remaining checks

The shape CSS and actual controller run in the local browser fixture, with
background-image and img covers, mock English/Arabic metadata, a neighboring
untargeted Bases root, and source cover crops from Ahmed's screenshot.
Screenshots are implementation previews on mock Bases DOM, not real vault
screenshots. Cover source resolution limits detail.

Automated checks cover nine validated options, legacy Standard default,
import/export, explicit target selection, profile/layout/disable/unload
cleanup, marker ownership, keyboard reveal, touch fallback, 320/390px layout,
missing covers, long titles, reduced motion and metadata visibility.

Real Obsidian DOM, virtualized scrolling, embedded Bases, theme conflicts,
mobile touch navigation and native selection/drag/menu behavior still need
vault testing. DOM class names are not a stable public contract. The user's
screenshot confirms the view type, not the DOM. No vault was accessed.

The published 0.1.1's global palette can still force dark colors in Light mode;
that is a separate planned fix, not silently changed here. Light/dark shape
screenshots use explicit fixture host palettes to inspect decoration contrast.

## Data safety

Back up data.json before testing a local build. The shape option adds a new
module setting, and older 0.1.1 validates unknown fields strictly. After the
new build saves custom profiles, downgrading may require restoring the backup.
Choosing Standard does not by itself make newly saved profiles readable by the
older release. Keep the published 0.1.1 tag/assets untouched.


## Text visibility correction after real-vault feedback

The first local build changed the cover and property positioning to relative.
That conflicts with Bases' native absolutely positioned cards, fixed inline
heights/top offsets, and strict paint containment, pushing metadata out of
its reserved card area. The original normal-flow mock did not reproduce this.

The corrected build preserves native cover positioning/height and all
metadata positions, sizes, and fonts. It removes shape-imposed cover margins
and aspect ratios. Decorations remain on artwork, with properties layered
above them. Circle clips only the artwork within the existing cover box.

Verification now also uses native app.css from the official Obsidian 1.15.1
release with simulated absolute-positioned cards and inline geometry. The
previous code reproduces displaced/clipped text. The correction passes all
nine options across 216 width/aspect-ratio/light-dark combinations, with
English/Arabic properties and missing covers, checking geometry, clipping,
and frontmost hit targets. All nine were visually inspected. This is still
not Ahmed's exact live vault/theme/version; his confirmation is required.

Native CSS source:
https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.15.1


## Book refinement toward the supplied concept

Book now uses an internal decorative portrait layer with a subtle 3D turn,
spine highlight, visible page block, and artwork-sized shadow. Native cover
size/position and all metadata geometry remain unchanged. The source image
is contained rather than stretched. An approximately 2:3 native cover slot
is closest to the concept; square/wide slots show a smaller fitted book.
Forced colors and unsupported container-size styling fall back to ordinary
contained cover artwork. No gallery palette, saved-view settings, new UI
sliders, or storage schema was changed.
