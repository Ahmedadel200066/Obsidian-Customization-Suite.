const { createDefaults, validateSettings } = require("../settings-utils");

const SCHEMA = {
  tableTextSize: { type: "range", default: 14, min: 10, max: 24 },
  tableRowHeight: { type: "range", default: 36, min: 24, max: 80 },
  tableMinColumnWidth: { type: "range", default: 40, min: 24, max: 320 },
  tableMaxColumnWidth: { type: "range", default: 300, min: 80, max: 1200 },
  tableContainerBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
  tableContainerRadius: { type: "range", default: 8, min: 0, max: 32 },
  tableHeaderBackground: { type: "color", default: "#343a46" },
  tableHeaderHover: { type: "color", default: "#414956" },
  tableHeaderColor: { type: "color", default: "#e7e9ed" },
  tableHeaderWeight: { type: "select", default: "600", options: ["normal", "500", "600", "700"] },
  tableHeaderIcons: { type: "boolean", default: true },
  tableBorderColor: { type: "color", default: "#454c58" },
  tableColumnBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
  tableRowBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
  tableRowHover: { type: "color", default: "#363d49" },
  tableActiveCellRadius: { type: "range", default: 4, min: 0, max: 24 },
  tableActiveCellBackground: { type: "color", default: "#303743" },
  tableDisabledCellBackground: { type: "color", default: "#252a32" },
  cardsContainerBackground: { type: "color", default: "#20242b" },
  cardsBackground: { type: "color", default: "#252a32" },
  cardsCoverBackground: { type: "color", default: "#343a46" },
  cardsScale: { type: "range", default: 1, min: 0.6, max: 1.5, step: 0.05 },
  cardsGroupPadding: { type: "range", default: 12, min: 0, max: 48 },
  cardsLineHeight: { type: "range", default: 24, min: 12, max: 48 },
  cardsBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
  cardsShadow: { type: "range", default: 20, min: 0, max: 100 },
  diagnostics: { type: "boolean", default: false },
  customCss: { type: "text", default: "", maxLength: 10000 }
};

const CONTROL_GROUPS = [
  {
    name: "Table view",
    controls: [
      { key: "tableTextSize", name: "Text size", type: "range", unit: "px" },
      { key: "tableRowHeight", name: "Row height", type: "range", unit: "px" },
      { key: "tableMinColumnWidth", name: "Minimum column width", type: "range", unit: "px" },
      { key: "tableMaxColumnWidth", name: "Maximum column width", type: "range", unit: "px" },
      { key: "tableContainerBorderWidth", name: "Container border width", type: "range", unit: "px" },
      { key: "tableContainerRadius", name: "Container corner radius", type: "range", unit: "px" },
      { key: "tableHeaderBackground", name: "Header background", type: "color" },
      { key: "tableHeaderHover", name: "Header hover background", type: "color" },
      { key: "tableHeaderColor", name: "Header text", type: "color" },
      { key: "tableHeaderWeight", name: "Header text weight", type: "select" },
      { key: "tableHeaderIcons", name: "Show header icons", type: "boolean" },
      { key: "tableBorderColor", name: "Table border color", type: "color" },
      { key: "tableColumnBorderWidth", name: "Column border width", type: "range", unit: "px" },
      { key: "tableRowBorderWidth", name: "Row border width", type: "range", unit: "px" },
      { key: "tableRowHover", name: "Row hover background", type: "color" },
      { key: "tableActiveCellRadius", name: "Active cell corner radius", type: "range", unit: "px" },
      { key: "tableActiveCellBackground", name: "Active cell background", type: "color" },
      { key: "tableDisabledCellBackground", name: "Disabled cell background", type: "color" }
    ]
  },
  {
    name: "Cards and gallery",
    controls: [
      { key: "cardsContainerBackground", name: "Gallery background", type: "color" },
      { key: "cardsBackground", name: "Card background", type: "color" },
      { key: "cardsCoverBackground", name: "Cover background", type: "color" },
      { key: "cardsScale", name: "Card scale", type: "range" },
      { key: "cardsGroupPadding", name: "Group spacing", type: "range", unit: "px" },
      { key: "cardsLineHeight", name: "Card text line height", type: "range", unit: "px" },
      { key: "cardsBorderWidth", name: "Card border width", type: "range", unit: "px" },
      { key: "cardsShadow", name: "Card shadow", type: "range", unit: "%" }
    ]
  },
  {
    name: "Diagnostics",
    controls: [{
      key: "diagnostics",
      name: "Enable development diagnostics",
      type: "boolean",
      desc: "Log Bases detection, view counts, and applied CSS variable names only."
    }]
  }
];

function validate(value) {
  const result = validateSettings("Obsidian Bases", value, SCHEMA);
  if (result.tableMinColumnWidth > result.tableMaxColumnWidth) {
    throw new Error("Obsidian Bases minimum column width cannot exceed maximum width.");
  }
  return result;
}

module.exports = {
  SCHEMA,
  CONTROL_GROUPS,
  DEFAULT_SETTINGS: createDefaults(SCHEMA),
  validate
};
