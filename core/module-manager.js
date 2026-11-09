const MODULES = require("../modules");

class ModuleManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.modules = MODULES;
    this.controllers = new Map();
  }

  load() {
    for (const module of this.modules) {
      const controller = module.createController(this.plugin, this, module);
      this.controllers.set(module.id, controller);
      controller.start();
    }

    this.plugin.registerEvent(
      this.plugin.app.workspace.on("layout-change", () => this.refreshWithNotice())
    );
    this.plugin.register(() => this.unload());
  }

  isEnabled(moduleId) {
    const profile = this.plugin.profileManager.getActiveProfile();
    return profile.moduleEnabled[moduleId] !== false;
  }

  setEnabled(moduleId, enabled) {
    if (!this.controllers.has(moduleId)) {
      throw new Error(`Unknown customization module "${moduleId}".`);
    }
    this.plugin.profileManager.setModuleEnabled(moduleId, enabled);
  }

  isTargetPluginEnabled(module) {
    if (module.target.type === "core") {
      const internalPlugins = this.plugin.app.internalPlugins;
      if (!internalPlugins) return false;
      for (const pluginId of module.target.ids) {
        const plugin = typeof internalPlugins.getPluginById === "function"
          ? internalPlugins.getPluginById(pluginId)
          : internalPlugins.plugins?.[pluginId];
        if (plugin?.enabled === true) return true;
        if (typeof internalPlugins.getEnabledPluginById === "function" &&
            internalPlugins.getEnabledPluginById(pluginId)) return true;
      }
      return false;
    }

    const plugins = this.plugin.app.plugins;
    for (const pluginId of module.target.ids) {
      if (plugins?.enabledPlugins?.has(pluginId)) return true;
      if (plugins?.getPlugin?.(pluginId)) return true;
    }
    return false;
  }

  getDetectedColumns(moduleId) {
    const controller = this.controllers.get(moduleId);
    return controller?.getColumnNames?.() || [];
  }

  refresh(profile = this.plugin.profileManager.getActiveProfile()) {
    for (const controller of this.controllers.values()) controller.refresh(profile);
  }

  refreshWithNotice() {
    try {
      this.refresh();
    } catch (error) {
      console.error("Customization Studio failed to update module styles after a workspace change.", error);
      this.plugin.notifyUser(`Customization Studio could not update a module: ${error.message}`);
    }
  }

  unload() {
    for (const controller of this.controllers.values()) controller.unload();
    this.controllers.clear();
  }
}

module.exports = { MODULES, ModuleManager };
