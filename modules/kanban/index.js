const settings = require("./settings");
const { KanbanController, styles } = require("./controller");
const selectors = require("./selectors");
const { scopeCss } = require("../css-scope");

module.exports = {
  id: "kanban",
  name: "Kanban",
  target: { type: "community", ids: ["obsidian-kanban"] },
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
  createController: (plugin, manager, module) => new KanbanController(plugin, manager, module)
};
