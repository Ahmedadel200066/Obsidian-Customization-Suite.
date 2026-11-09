const { createDefaults, validateSettings } = require("../settings-utils");

const SCHEMA = {
  automaticColumnColors: { type: "boolean", default: true },
  columnColors: { type: "colorMap", default: {} },
  columnBackground: { type: "color", default: "#343a46" },
  columnOpacity: { type: "range", default: 100, min: 0, max: 100 },
  cardBackground: { type: "color", default: "#222630" },
  cardOpacity: { type: "range", default: 100, min: 0, max: 100 },
  columnRadius: { type: "range", default: 8, min: 0, max: 32 },
  cardRadius: { type: "range", default: 6, min: 0, max: 32 },
  columnSpacing: { type: "range", default: 12, min: 0, max: 48 },
  columnPadding: { type: "range", default: 10, min: 0, max: 40 },
  cardSpacing: { type: "range", default: 8, min: 0, max: 32 },
  cardPadding: { type: "range", default: 8, min: 0, max: 32 },
  columnBlur: { type: "range", default: 0, min: 0, max: 20 },
  backgroundImage: { type: "text", default: "", maxLength: 2048, url: true },
  backgroundImageOpacity: { type: "range", default: 25, min: 0, max: 100 },
  backgroundOverlay: { type: "color", default: "#000000" },
  backgroundOverlayOpacity: { type: "range", default: 15, min: 0, max: 100 },
  backgroundSize: { type: "select", default: "cover", options: ["cover", "contain", "auto", "100% 100%"] },
  backgroundPosition: {
    type: "select",
    default: "center center",
    options: ["center center", "center top", "center bottom", "left center", "right center"]
  },
  hoverGlow: { type: "boolean", default: true },
  glowIntensity: { type: "range", default: 35, min: 0, max: 100 },
  hoverLift: { type: "boolean", default: true },
  dragStyle: { type: "select", default: "lift", options: ["lift", "glow", "ghost", "outline", "smooth"] },
  customCss: { type: "text", default: "", maxLength: 10000 }
};

const CONTROL_GROUPS = [
  {
    name: "Columns",
    controls: [
      { key: "automaticColumnColors", name: "Color columns by name", type: "boolean" },
      { key: "columnBackground", name: "Default column color", type: "color" },
      { key: "columnOpacity", name: "Column opacity", type: "range", unit: "%" },
      { key: "columnRadius", name: "Column corner radius", type: "range", unit: "px" },
      { key: "columnSpacing", name: "Column spacing", type: "range", unit: "px" },
      { key: "columnPadding", name: "Column padding", type: "range", unit: "px" },
      { key: "columnBlur", name: "Column blur", type: "range", unit: "px" }
    ]
  },
  {
    name: "Cards",
    controls: [
      { key: "cardBackground", name: "Card color", type: "color" },
      { key: "cardOpacity", name: "Card opacity", type: "range", unit: "%" },
      { key: "cardRadius", name: "Card corner radius", type: "range", unit: "px" },
      { key: "cardSpacing", name: "Card spacing", type: "range", unit: "px" },
      { key: "cardPadding", name: "Card padding", type: "range", unit: "px" },
      { key: "hoverGlow", name: "Glow on hover", type: "boolean" },
      { key: "glowIntensity", name: "Hover glow strength", type: "range", unit: "%" },
      { key: "hoverLift", name: "Lift on hover", type: "boolean" }
    ]
  },
  {
    name: "Board background",
    controls: [
      { key: "backgroundImage", name: "Image URL", type: "text" },
      { key: "backgroundImageOpacity", name: "Image opacity", type: "range", unit: "%" },
      { key: "backgroundOverlay", name: "Overlay color", type: "color" },
      { key: "backgroundOverlayOpacity", name: "Overlay opacity", type: "range", unit: "%" },
      { key: "backgroundSize", name: "Image sizing", type: "select" },
      { key: "backgroundPosition", name: "Image position", type: "select" }
    ]
  },
  {
    name: "Drag appearance",
    controls: [{ key: "dragStyle", name: "Drag visual style", type: "select" }]
  }
];

function validate(value) {
  return validateSettings("Kanban", value, SCHEMA);
}

module.exports = {
  SCHEMA,
  CONTROL_GROUPS,
  DEFAULT_SETTINGS: createDefaults(SCHEMA),
  validate
};
