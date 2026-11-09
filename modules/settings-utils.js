function createDefaults(schema) {
  const defaults = {};
  for (const [key, definition] of Object.entries(schema)) {
    defaults[key] = typeof definition.default === "object" && definition.default !== null
      ? JSON.parse(JSON.stringify(definition.default))
      : definition.default;
  }
  return defaults;
}

function validateSettings(moduleName, value, schema) {
  if (value == null) value = {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${moduleName} settings must be an object.`);
  }

  const result = createDefaults(schema);
  for (const [key, incoming] of Object.entries(value)) {
    const definition = schema[key];
    if (!definition) throw new Error(`${moduleName} has an unsupported setting "${key}".`);
    if (definition.type === "colorMap") {
      if (typeof incoming !== "object" || incoming === null || Array.isArray(incoming)) {
        throw new Error(`${moduleName} ${key} must be an object of color overrides.`);
      }
      const entries = {};
      for (const [name, color] of Object.entries(incoming)) {
        if (!name.trim() || name.length > 80 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
          throw new Error(`${moduleName} ${key} contains an invalid column name or color.`);
        }
        entries[name] = color;
      }
      result[key] = entries;
      continue;
    }

    switch (definition.type) {
      case "boolean":
        if (typeof incoming !== "boolean") {
          throw new Error(`${moduleName} ${key} must be a boolean.`);
        }
        break;
      case "color":
        if (typeof incoming !== "string" || !/^#[0-9a-fA-F]{6}$/.test(incoming)) {
          throw new Error(`${moduleName} ${key} must be a six-digit hex color.`);
        }
        break;
      case "range":
        if (typeof incoming !== "number" || !Number.isFinite(incoming) ||
            incoming < definition.min || incoming > definition.max) {
          throw new Error(`${moduleName} ${key} must be between ${definition.min} and ${definition.max}.`);
        }
        break;
      case "select":
        if (!definition.options.includes(incoming)) {
          throw new Error(`${moduleName} ${key} is not a supported option.`);
        }
        break;
      case "text":
        if (typeof incoming !== "string" || incoming.length > (definition.maxLength || 2000)) {
          throw new Error(`${moduleName} ${key} must be text no longer than ${definition.maxLength || 2000} characters.`);
        }
        if (definition.url && incoming !== "" && !/^https?:\/\/[^\s"'<>]+$/i.test(incoming)) {
          throw new Error(`${moduleName} ${key} must be an HTTP or HTTPS URL.`);
        }
        break;
      default:
        throw new Error(`${moduleName} has an invalid setting schema for "${key}".`);
    }
    result[key] = incoming;
  }
  return result;
}

function rgba(hex, alpha) {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

module.exports = { createDefaults, validateSettings, rgba };
