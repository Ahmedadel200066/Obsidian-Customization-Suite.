const HOVER_EFFECTS = Object.freeze({ off: "Off", glow: "Glow", lift: "Lift", flip: "Flip artwork", wiggle: "Wiggle" });
const COMMON = { size: { name: "Artwork size", min: 50, max: 150, step: 1, default: 100, unit: "%", desc: "Uses native card sizing so artwork gets bigger or smaller without scaling or hiding the text." }, hover: { name: "Hover effect", options: Object.keys(HOVER_EFFECTS), default: "off" } };
const SHAPE_CONTROLS = {
  standard: {},
  book: { angle: { name: "Book depth", min: 0, max: 20, default: 12, unit: "°" }, pages: { name: "Page-edge thickness", min: 0, max: 12, default: 7, unit: "px" }, detail: { name: "Page-line spacing", min: 1, max: 4, step: .5, default: 2, unit: "px", desc: "Decorative page lines, not the note's actual page count." } },
  poster: { frame: { name: "Print border", min: 1, max: 16, default: 7, unit: "px" }, shadow: { name: "Print shadow", min: 0, max: 100, default: 40, unit: "%" } },
  circle: { diameter: { name: "Circle diameter", min: 60, max: 100, default: 100, unit: "%" }, crop: { name: "Vertical crop position", min: 0, max: 100, default: 50, unit: "%" } },
  spine: { angle: { name: "Closed spine angle", min: 40, max: 80, default: 72, unit: "°" }, reveal: { name: "Reveal on hover or focus", default: true, desc: "Touch devices always show full covers." } },
  polaroid: { tilt: { name: "Print tilt", min: -6, max: 6, default: -2, unit: "°" }, bottom: { name: "Lower border", min: 8, max: 45, default: 30, unit: "px" } },
  "trading-card": { frame: { name: "Metallic border", min: 1, max: 14, default: 6, unit: "px" }, sheen: { name: "Sheen strength", min: 0, max: 50, default: 20, unit: "%" } },
  disc: { protrusion: { name: "Disc protrusion", min: 0, max: 55, default: 34, unit: "%" }, diameter: { name: "Disc diameter", min: 60, max: 96, default: 92, unit: "%" } },
  ticket: { notch: { name: "Notch radius", min: 0, max: 14, default: 9, unit: "px" }, perforation: { name: "Perforated edges", default: true } }
};
function shapeSchema(shape) { if (!Object.hasOwn(SHAPE_CONTROLS, shape)) throw new Error("Unknown card shape."); return { ...COMMON, ...SHAPE_CONTROLS[shape] }; }
function validateShapeOptions(shape, value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Shape options must be an object.");
  const schema = shapeSchema(shape), result = {};
  for (const key of Object.keys(value)) if (!Object.hasOwn(schema, key)) throw new Error(`Unknown ${shape} option: ${key}.`);
  for (const [key, definition] of Object.entries(schema)) {
    const current = value[key] ?? definition.default;
    if (definition.options ? !definition.options.includes(current) : typeof definition.default === "boolean" ? typeof current !== "boolean" : typeof current !== "number" || !Number.isFinite(current) || current < definition.min || current > definition.max) throw new Error(`Invalid ${shape} ${key}.`);
    result[key] = current;
  }
  return result;
}
module.exports = { HOVER_EFFECTS, shapeSchema, validateShapeOptions };
