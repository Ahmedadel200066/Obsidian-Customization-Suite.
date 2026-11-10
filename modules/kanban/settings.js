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
  columnGlowEnabled: { type: "boolean", default: false },
  columnGlowColor: { type: "color", default: "#7c6ce7" },
  columnGlowIntensity: { type: "range", default: 35, min: 0, max: 100 },
  columnGlowBlur: { type: "range", default: 18, min: 0, max: 80 },
  columnGlowMode: { type: "select", default: "hover", options: ["hover", "always"] },
  backgroundImage: { type: "text", default: "", maxLength: 2048 },
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
  cardGlowColor: { type: "color", default: "#7c6ce7" },
  cardGlowBlur: { type: "range", default: 18, min: 0, max: 80 },
  cardGlowMode: { type: "select", default: "hover", options: ["hover", "always"] },
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
      { key: "columnRadius", name: "Column corner radius", type: "range", unit: "px" },
      { key: "columnSpacing", name: "Column spacing", type: "range", unit: "px" },
      { key: "columnPadding", name: "Column padding", type: "range", unit: "px" }
    ]
  },
  {
    name: "Colors",
    controls: [
      { key: "columnOpacity", name: "Column opacity", type: "range", unit: "%" },
      { key: "cardBackground", name: "Card color", type: "color" },
      { key: "cardOpacity", name: "Card opacity", type: "range", unit: "%" }
    ]
  },
  {
    name: "Cards",
    controls: [
      { key: "cardRadius", name: "Card corner radius", type: "range", unit: "px" },
      { key: "cardSpacing", name: "Card spacing", type: "range", unit: "px" },
      { key: "cardPadding", name: "Card padding", type: "range", unit: "px" },
      { key: "hoverLift", name: "Lift on hover", type: "boolean" }
    ]
  },
  {
    name: "Blur",
    controls: [{
      key: "columnBlur",
      name: "Column blur",
      type: "range",
      unit: "px",
      desc: "Blur is visible through a translucent lane surface; enabling blur caps lane opacity at 75%."
    }]
  },
  {
    name: "Glow",
    controls: [
      { key: "hoverGlow", name: "Enable card glow", type: "boolean" },
      { key: "glowIntensity", name: "Card glow intensity", type: "range", unit: "%" },
      { key: "cardGlowColor", name: "Card glow color", type: "color" },
      { key: "cardGlowBlur", name: "Card glow blur", type: "range", unit: "px" },
      { key: "cardGlowMode", name: "Card glow mode", type: "select" },
      { key: "columnGlowEnabled", name: "Enable column glow", type: "boolean" },
      { key: "columnGlowColor", name: "Column glow color", type: "color" },
      { key: "columnGlowIntensity", name: "Column glow intensity", type: "range", unit: "%" },
      { key: "columnGlowBlur", name: "Column glow blur", type: "range", unit: "px" },
      { key: "columnGlowMode", name: "Column glow mode", type: "select" }
    ]
  },
  {
    name: "Board background",
    controls: [
      { key: "backgroundImage", name: "Vault image path or external URL", type: "text" },
      { key: "backgroundImageOpacity", name: "Image opacity", type: "range", unit: "%" },
      { key: "backgroundOverlay", name: "Overlay color", type: "color" },
      { key: "backgroundOverlayOpacity", name: "Overlay opacity", type: "range", unit: "%" },
      { key: "backgroundSize", name: "Image sizing", type: "select" },
      { key: "backgroundPosition", name: "Image position", type: "select" }
    ]
  },
  {
    name: "Drag and Drop",
    controls: [{ key: "dragStyle", name: "Drag visual style", type: "select" }]
  }
];

function validate(value) {
  const result = validateSettings("Kanban", value, SCHEMA);
  const image = result.backgroundImage.trim();
  if (!image) {
    result.backgroundImage = "";
    return result;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(image)) {
    let url;
    try {
      url = new URL(image);
    } catch {
      throw new Error("Kanban background image must be a valid vault path or HTTP(S) URL.");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Kanban background image URLs must use HTTP or HTTPS.");
    }
    result.backgroundImage = url.href;
    return result;
  }

  const normalizedPath = image.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (normalizedPath.startsWith("/") || /^[a-z]:\//i.test(normalizedPath) ||
      normalizedPath.split("/").some((part) => part === "..") ||
      /[\u0000-\u001f]/.test(normalizedPath)) {
    throw new Error("Kanban background image must be a relative path inside the vault.");
  }
  result.backgroundImage = normalizedPath;
  return result;
}

module.exports = {
  SCHEMA,
  CONTROL_GROUPS,
  DEFAULT_SETTINGS: createDefaults(SCHEMA),
  validate
};
