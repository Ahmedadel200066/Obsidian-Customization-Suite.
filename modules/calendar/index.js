const { createStyleModule, paletteColor } = require("../create-style-module");

// Calendar 1.5.10, source ef3f269: documented variables, no Svelte hash selectors.
module.exports = createStyleModule({
  id: "calendar",
  name: "Calendar",
  pluginId: "calendar",
  root: "#calendar-container",
  compatibilityNote: "Source-inspected against Calendar 1.5.10. Uses its documented CSS variables; live vault compatibility still needs testing.",
  schema: {
    useThemeColors: { type: "boolean", default: true },
    textColor: { type: "color", default: "#dddddd" },
    mutedColor: { type: "color", default: "#999999" },
    todayColor: { type: "color", default: "#7c6ce7" },
    dotColor: { type: "color", default: "#7c6ce7" },
    weekendBackground: { type: "color", default: "#282832" },
    highlightWeekends: { type: "boolean", default: true },
    fontSize: { type: "range", default: 14, min: 11, max: 20 },
    padding: { type: "range", default: 8, min: 0, max: 24 },
    radius: { type: "range", default: 8, min: 0, max: 24 }
  },
  groups: [
    { name: "Calendar layout", controls: [
      { key: "fontSize", name: "Calendar text size", type: "range", unit: "px" },
      { key: "padding", name: "Calendar outer padding", type: "range", unit: "px" },
      { key: "radius", name: "Calendar corner radius", type: "range", unit: "px" },
      { key: "highlightWeekends", name: "Highlight weekends", type: "boolean" }
    ] },
    { name: "Calendar colors", controls: [
      { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use the custom colors below. Dates and daily-note behavior are unchanged." },
      { key: "textColor", name: "Calendar day and title text", type: "color" },
      { key: "mutedColor", name: "Calendar headings and navigation", type: "color" },
      { key: "todayColor", name: "Calendar today text", type: "color" },
      { key: "dotColor", name: "Calendar activity dots", type: "color" },
      { key: "weekendBackground", name: "Calendar weekend background", type: "color" }
    ] }
  ],
  styles(settings) {
    const text = paletteColor(settings, "textColor", "--text-normal");
    const muted = paletteColor(settings, "mutedColor", "--text-muted");
    return `#calendar-container {
      --color-text-title: ${text};
      --color-text-day: ${text};
      --color-text-heading: ${muted};
      --color-text-weeknum: ${muted};
      --color-arrow: ${muted};
      --color-button: ${muted};
      --color-text-today: ${paletteColor(settings, "todayColor", "--interactive-accent")};
      --color-dot: ${paletteColor(settings, "dotColor", "--interactive-accent")};
      --color-background-weekend: ${settings.highlightWeekends ? paletteColor(settings, "weekendBackground", "--background-secondary") : "transparent"};
      font-size: ${settings.fontSize}px;
      padding: ${settings.padding}px;
      border-radius: ${settings.radius}px;
    }`;
  }
});
