const { createDefaults, validateSettings } = require("../settings-utils");

const SCHEMA = {
  cardBackground: { type: "color", default: "#252a32" },
  cardBorderColor: { type: "color", default: "#454c58" },
  cardRadius: { type: "range", default: 12, min: 0, max: 36 },
  cardShadow: { type: "range", default: 20, min: 0, max: 100 },
  cardPadding: { type: "range", default: 20, min: 0, max: 64 },
  cardSpacing: { type: "range", default: 16, min: 0, max: 48 },
  contentFontSize: { type: "range", default: 100, min: 70, max: 180 },
  contentFontWeight: { type: "select", default: "normal", options: ["normal", "500", "600", "700"] },
  contentColor: { type: "color", default: "#e7e9ed" },
  reviewAreaBackground: { type: "color", default: "#303743" },
  reviewAreaPadding: { type: "range", default: 12, min: 0, max: 40 },
  showAnswerColor: { type: "color", default: "#477db4" },
  againColor: { type: "color", default: "#c94e4e" },
  hardColor: { type: "color", default: "#d87938" },
  goodColor: { type: "color", default: "#3d9b61" },
  easyColor: { type: "color", default: "#397faa" },
  buttonRadius: { type: "range", default: 8, min: 0, max: 32 },
  buttonHeight: { type: "range", default: 48, min: 32, max: 80 },
  buttonGap: { type: "range", default: 8, min: 0, max: 32 },
  transitionDuration: { type: "range", default: 180, min: 0, max: 600 },
  diagnostics: { type: "boolean", default: false },
  customCss: { type: "text", default: "", maxLength: 10000 }
};

const CONTROL_GROUPS = [
  {
    name: "Flashcard",
    controls: [
      { key: "cardBackground", name: "Card background", type: "color" },
      { key: "cardBorderColor", name: "Card border", type: "color" },
      { key: "cardRadius", name: "Corner radius", type: "range", unit: "px" },
      { key: "cardShadow", name: "Shadow strength", type: "range", unit: "%" },
      { key: "cardPadding", name: "Card padding", type: "range", unit: "px" },
      { key: "cardSpacing", name: "Study interface spacing", type: "range", unit: "px" }
    ]
  },
  {
    name: "Card text",
    controls: [
      { key: "contentFontSize", name: "Question and answer size", type: "range", unit: "%" },
      { key: "contentFontWeight", name: "Text weight", type: "select" },
      { key: "contentColor", name: "Text color", type: "color" }
    ]
  },
  {
    name: "Answer and review controls",
    controls: [
      { key: "reviewAreaBackground", name: "Review controls background", type: "color" },
      { key: "reviewAreaPadding", name: "Review controls padding", type: "range", unit: "px" },
      { key: "showAnswerColor", name: "Show answer button", type: "color" },
      { key: "againColor", name: "Again button", type: "color" },
      { key: "hardColor", name: "Hard button", type: "color" },
      { key: "goodColor", name: "Good button", type: "color" },
      { key: "easyColor", name: "Easy button", type: "color" },
      { key: "buttonRadius", name: "Button corner radius", type: "range", unit: "px" },
      { key: "buttonHeight", name: "Button height", type: "range", unit: "px" },
      { key: "buttonGap", name: "Button spacing", type: "range", unit: "px" }
    ]
  },
  {
    name: "Motion",
    controls: [{ key: "transitionDuration", name: "Hover transition", type: "range", unit: "ms" }]
  },
  {
    name: "Diagnostics",
    controls: [{
      key: "diagnostics",
      name: "Enable development diagnostics",
      type: "boolean",
      desc: "Log detection and matched element counts only; flashcard text is never logged."
    }]
  }
];

function validate(value) {
  return validateSettings("Spaced Repetition", value, SCHEMA);
}

module.exports = {
  SCHEMA,
  CONTROL_GROUPS,
  DEFAULT_SETTINGS: createDefaults(SCHEMA),
  validate
};
