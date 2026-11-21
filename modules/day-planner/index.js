const { createStyleModule, paletteColor } = require("../create-style-module");

const ROOT = '[data-type="planner-timeline"], [data-type="planner-weekly"], [data-type="planner-time-tracker"]';

// Day Planner 0.35.1, source 9c483b3: inherited tokens from styles.scss and
// column.svelte / time-block-base.svelte / time-block-content-layout.svelte.
// Never change geometry tokens, inline per-block colors, or active state borders.
module.exports = createStyleModule({
  id: "day-planner",
  name: "Day Planner",
  pluginId: "obsidian-day-planner",
  root: ROOT,
  compatibilityNote: "Source-inspected against Day Planner 0.35.1. Timeline, weekly, and time-tracker appearance only. Time positions, drag handles, per-event colors, and active borders are preserved. Native drag/resize still needs vault testing.",
  schema: {
    useThemeColors: { type: "boolean", default: true },
    timelineBackground: { type: "color", default: "#202027" },
    gridColor: { type: "color", default: "#44444d" },
    textSize: { type: "range", default: 13, min: 10, max: 20 },
    blockRadius: { type: "range", default: 6, min: 0, max: 18 },
    contentSpacing: { type: "range", default: 4, min: 0, max: 12 },
    contentPadding: { type: "range", default: 4, min: 0, max: 12 },
    gridWidth: { type: "range", default: 1, min: 0, max: 3 },
    blockShadow: { type: "range", default: 15, min: 0, max: 50 },
    fontFamily: { type: "select", default: "interface", options: ["interface", "text", "monospace"] }
  },
  groups: [
    { name: "Timeline and time blocks", controls: [
      { key: "textSize", name: "Planner time-block text size", type: "range", unit: "px" },
      { key: "fontFamily", name: "Planner time-block font", type: "select" },
      { key: "blockRadius", name: "Planner time-block corner radius", type: "range", unit: "px" },
      { key: "contentSpacing", name: "Planner content gap", type: "range", unit: "px" },
      { key: "contentPadding", name: "Planner content inner padding", type: "range", unit: "px", desc: "Does not change block position or duration; large values can leave less room in short blocks." },
      { key: "gridWidth", name: "Planner hour separator width", type: "range", unit: "px" },
      { key: "blockShadow", name: "Planner block shadow strength", type: "range", unit: "%" }
    ] },
    { name: "Planner colors", controls: [
      { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use the custom timeline and grid colors. Event colors and state borders remain owned by Day Planner." },
      { key: "timelineBackground", name: "Planner timeline background", type: "color" },
      { key: "gridColor", name: "Planner hour separator color", type: "color" }
    ] }
  ],
  styles(settings) {
    const font = { interface: "--font-interface", text: "--font-text", monospace: "--font-monospace" }[settings.fontFamily];
    return `:is(${ROOT}) {
      --column-background-color: ${paletteColor(settings, "timelineBackground", "--background-primary")};
      --planner-time-block-font-size: ${settings.textSize}px;
      --planner-time-block-font-family: var(${font});
      --time-block-border-radius: ${settings.blockRadius}px;
      --time-block-content-layout-gap: ${settings.contentSpacing}px;
      --time-block-content-layout-padding: ${settings.contentPadding}px;
      --planner-time-block-shadow-on-timeline: 0 2px 6px rgba(0, 0, 0, ${settings.blockShadow / 100});
    }
    :is(${ROOT}) .view-content {
      --border-base: ${settings.gridWidth}px solid ${paletteColor(settings, "gridColor", "--background-modifier-border")};
    }`;
  }
});
