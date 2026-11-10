const settings = require("./settings");
const { SpacedRepetitionController, styles } = require("./controller");
const selectors = require("./selectors");
const { scopeCss } = require("../css-scope");

module.exports = {
  id: "spaced-repetition",
  name: "Spaced Repetition",
  target: { type: "community", ids: ["obsidian-spaced-repetition"] },
  rootSelector: selectors.root,
  selectors,
  defaultSettings: settings.DEFAULT_SETTINGS,
  settingsSchema: settings.SCHEMA,
  controlGroups: settings.CONTROL_GROUPS,
  validateSettings(value) {
    const validated = settings.validate(value);
    scopeCss(validated.customCss, selectors.root);
    return validated;
  },
  styles,
  customCss: (value) => scopeCss(value.customCss, selectors.root),
  createController: (plugin, manager, module) => new SpacedRepetitionController(plugin, manager, module)
};
