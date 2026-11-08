const MODULES = require("../modules");

class ModuleManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.themeEngine = null;
    this.moduleStyles = new Map();
    this.modules = MODULES;
  }

  load() {
    this.themeEngine = this.plugin.themeEngine;
    this.plugin.register(() => this.unload());
  }

  isEnabled(moduleId) {
    return this.plugin.settingsManager.settings.moduleEnabled[moduleId] !== false;
  }

  setEnabled(moduleId, enabled) {
    if (!this.modules.some((module) => module.id === moduleId)) {
      throw new Error(`Unknown customization module "${moduleId}".`);
    }
    this.plugin.settingsManager.settings.moduleEnabled[moduleId] = enabled;
  }

  isTargetPluginEnabled(module) {
    return module.pluginIds.some((pluginId) => this.plugin.app.plugins.enabledPlugins.has(pluginId));
  }

  refresh(profile = this.plugin.profileManager.getActiveProfile()) {
    const activeIds = [];
    for (const module of this.modules) {
      const styleId = `module-${module.id}`;
      const css = profile.moduleCss[module.id] || "";
      if (!this.isEnabled(module.id) || !this.isTargetPluginEnabled(module)) {
        this.moduleStyles.get(module.id)?.remove();
        this.moduleStyles.delete(module.id);
        continue;
      }

      activeIds.push(module.id);
      let style = this.moduleStyles.get(module.id);
      if (!style) {
        style = this.plugin.app.workspace.containerEl.ownerDocument.createElement("style");
        style.dataset.customizationStudioStyle = styleId;
        this.plugin.app.workspace.containerEl.ownerDocument.head.appendChild(style);
        this.moduleStyles.set(module.id, style);
        this.plugin.register(() => style.remove());
      }
      style.textContent = css;
    }
    this.plugin.app.workspace.containerEl.ownerDocument.body.dataset.customizationStudioModules = activeIds.join(" ");
  }

  unload() {
    for (const style of this.moduleStyles.values()) style.remove();
    this.moduleStyles.clear();
    delete this.plugin.app.workspace.containerEl.ownerDocument.body.dataset.customizationStudioModules;
  }
}

module.exports = { MODULES, ModuleManager };
