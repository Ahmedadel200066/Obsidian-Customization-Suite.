const { createStyleModule, paletteColor } = require("../create-style-module");

// Dataview 0.5.68, source 5ad0994: standard table/list and inline-field output.
module.exports = createStyleModule({
  id: "dataview",
  name: "Dataview",
  pluginId: "dataview",
  root: ".block-language-dataview, .table-view-table, .dataview.inline-field-key, .dataview.inline-field-value, .dataview.inline-field-standalone-value, .dataview-result-list-root-ul",
  compatibilityNote: "Source-inspected against Dataview 0.5.68. Standard tables, lists, and inline fields only; arbitrary DataviewJS markup is not covered. Live vault testing is still required.",
  schema: {
    useThemeColors: { type: "boolean", default: true },
    headerBackground: { type: "color", default: "#30303a" },
    headerText: { type: "color", default: "#eeeeee" },
    stripeBackground: { type: "color", default: "#282832" },
    borderColor: { type: "color", default: "#44444d" },
    fieldBackground: { type: "color", default: "#30303a" },
    fieldText: { type: "color", default: "#dddddd" },
    fontSize: { type: "range", default: 14, min: 11, max: 22 },
    cellPadding: { type: "range", default: 8, min: 2, max: 20 },
    stripedRows: { type: "boolean", default: true },
    rowDividers: { type: "boolean", default: true },
    listSpacing: { type: "range", default: 3, min: 0, max: 14 },
    fieldRadius: { type: "range", default: 4, min: 0, max: 16 }
  },
  groups: [
    { name: "Tables and lists", controls: [
      { key: "fontSize", name: "Dataview table text size", type: "range", unit: "px" },
      { key: "cellPadding", name: "Dataview cell padding", type: "range", unit: "px" },
      { key: "stripedRows", name: "Alternating row backgrounds", type: "boolean" },
      { key: "rowDividers", name: "Show row dividers", type: "boolean" },
      { key: "listSpacing", name: "Dataview list spacing", type: "range", unit: "px" },
      { key: "fieldRadius", name: "Inline field corner radius", type: "range", unit: "px" }
    ] },
    { name: "Dataview colors", controls: [
      { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use the custom colors below. Query output and click behavior are unchanged." },
      { key: "headerBackground", name: "Dataview header background", type: "color" },
      { key: "headerText", name: "Dataview header text", type: "color" },
      { key: "stripeBackground", name: "Dataview alternating background", type: "color" },
      { key: "borderColor", name: "Dataview row border", type: "color" },
      { key: "fieldBackground", name: "Inline field background", type: "color" },
      { key: "fieldText", name: "Inline field text", type: "color" }
    ] }
  ],
  styles(settings) {
    const color = (key, variable) => paletteColor(settings, key, variable);
    return `.table-view-table {
      font-size: ${settings.fontSize}px;
      border-collapse: collapse;
    }
    .table-view-table > thead > tr > th {
      background: ${color("headerBackground", "--background-secondary")};
      color: ${color("headerText", "--text-normal")};
      padding: ${settings.cellPadding}px;
      border-bottom: 1px solid ${color("borderColor", "--background-modifier-border")};
    }
    .table-view-table > tbody > tr > td {
      padding: ${settings.cellPadding}px;
      border-bottom: ${settings.rowDividers ? `1px solid ${color("borderColor", "--background-modifier-border")}` : "0"};
    }
    ${settings.stripedRows ? `.table-view-table > tbody > tr:nth-child(even) {
      background: ${color("stripeBackground", "--background-secondary")};
    }` : ""}
    .table-view-table > tbody > tr:hover { background: var(--background-modifier-hover); }
    .dataview-result-list-root-ul li { margin-block: ${settings.listSpacing}px; }
    .dataview.inline-field-key, .dataview.inline-field-value, .dataview.inline-field-standalone-value {
      background: ${color("fieldBackground", "--background-secondary")};
      color: ${color("fieldText", "--text-normal")};
      border-radius: ${settings.fieldRadius}px;
    }`;
  }
});
