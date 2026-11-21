const { createStyleModule, paletteColor } = require("../create-style-module");

// Tasks 8.6.0, source 9fecdd6: query list, separate group headings and edit form.
module.exports = createStyleModule({
  id: "tasks",
  name: "Tasks",
  pluginId: "obsidian-tasks-plugin",
  root: ".plugin-tasks-query-result, .tasks-group-heading, .tasks-modal",
  compatibilityNote: "Source-inspected against Tasks 8.6.0 (which requires Obsidian 1.13.1). Query lists, group headings, metadata chips, and edit-form spacing. Live task editing still needs vault testing.",
  schema: {
    useThemeColors: { type: "boolean", default: true },
    groupColor: { type: "color", default: "#9b8bff" },
    dividerColor: { type: "color", default: "#44444d" },
    chipBackground: { type: "color", default: "#30303a" },
    rowSpacing: { type: "range", default: 4, min: 0, max: 16 },
    textSize: { type: "range", default: 15, min: 11, max: 22 },
    groupSize: { type: "range", default: 16, min: 12, max: 24 },
    groupSpacing: { type: "range", default: 16, min: 4, max: 40 },
    rowDividers: { type: "boolean", default: false },
    metadataChips: { type: "boolean", default: true },
    chipRadius: { type: "range", default: 4, min: 0, max: 16 },
    modalSectionSpacing: { type: "range", default: 10, min: 4, max: 28 }
  },
  groups: [
    { name: "Task query results", controls: [
      { key: "textSize", name: "Task text size", type: "range", unit: "px" },
      { key: "rowSpacing", name: "Task row spacing", type: "range", unit: "px" },
      { key: "rowDividers", name: "Task row dividers", type: "boolean" },
      { key: "groupSize", name: "Task group heading size", type: "range", unit: "px" },
      { key: "groupSpacing", name: "Task group spacing", type: "range", unit: "px" },
      { key: "metadataChips", name: "Date metadata chips", type: "boolean", desc: "Adds a surface behind dates without changing urgency, status colors, or click handlers." },
      { key: "chipRadius", name: "Date chip corner radius", type: "range", unit: "px" }
    ] },
    { name: "Tasks edit form and colors", controls: [
      { key: "modalSectionSpacing", name: "Task edit form section spacing", type: "range", unit: "px" },
      { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use custom colors. Checkbox states, priority, and error indicators are never recolored by this module." },
      { key: "groupColor", name: "Task group heading color", type: "color" },
      { key: "dividerColor", name: "Task divider color", type: "color" },
      { key: "chipBackground", name: "Task date chip background", type: "color" }
    ] }
  ],
  styles(settings) {
    return `.plugin-tasks-query-result { font-size: ${settings.textSize}px; }
    .plugin-tasks-query-result > li {
      padding-block: ${settings.rowSpacing}px;
      ${settings.rowDividers ? `border-bottom: 1px solid ${paletteColor(settings, "dividerColor", "--background-modifier-border")};` : ""}
    }
    .tasks-group-heading {
      color: ${paletteColor(settings, "groupColor", "--text-accent")};
      font-size: ${settings.groupSize}px;
      margin-block-start: ${settings.groupSpacing}px;
      margin-block-end: ${Math.round(settings.groupSpacing / 2)}px;
    }
    ${settings.metadataChips ? `.plugin-tasks-query-result :is(.task-due, .task-scheduled, .task-start, .task-created, .task-done, .task-cancelled) {
      background: ${paletteColor(settings, "chipBackground", "--background-secondary")};
      border-radius: ${settings.chipRadius}px;
      padding-inline: 0.2em;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }` : ""}
    .tasks-modal section + section { margin-top: ${settings.modalSectionSpacing}px; }`;
  }
});
