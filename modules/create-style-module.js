const { BaseModuleController } = require("./base-controller");
const { createDefaults, validateSettings } = require("./settings-utils");
const { scopeCss } = require("./css-scope");

// CSS-only integrations share lifecycle handling, not selectors or settings.
// Defaults are opt-in so upgrading does not restyle newly supported plugins.
function createStyleModule({ id, name, pluginId, root, schema, groups, styles, compatibilityNote }) {
  const settingsSchema = {
    ...schema,
    customCss: { type: "text", default: "", maxLength: 10000 }
  };
  const module = {
    id,
    name,
    defaultEnabled: false,
    target: { type: "community", ids: [pluginId] },
    rootSelector: root,
    selectors: { root },
    compatibilityNote,
    settingsSchema,
    defaultSettings: createDefaults(settingsSchema),
    controlGroups: groups,
    validateSettings(value) {
      const result = validateSettings(name, value, settingsSchema);
      scopeCss(result.customCss, root);
      return result;
    },
    styles,
    customCss: (value) => scopeCss(value.customCss, root),
    createController: (plugin, manager, definition) => new BaseModuleController(plugin, manager, definition)
  };
  return module;
}

function paletteColor(settings, key, themeVariable) {
  return settings.useThemeColors ? `var(${themeVariable})` : settings[key];
}

module.exports = { createStyleModule, paletteColor };
