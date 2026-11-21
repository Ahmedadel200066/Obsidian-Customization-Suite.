const MODULES = require("../modules");

class ModuleManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.modules = MODULES;
    this.controllers = new Map();
    this.documents = new Map();
    this.windowDocuments = new Set();
    this.closedDocuments = new WeakSet();
    this.pendingRefresh = null;
  }

  getDocuments() {
    const workspace = this.plugin.app.workspace;
    const documents = new Set([workspace.containerEl.ownerDocument]);
    workspace.iterateAllLeaves?.((leaf) => {
      const doc = leaf.view?.containerEl?.ownerDocument;
      if (doc && !this.closedDocuments.has(doc)) documents.add(doc);
    });
    for (const doc of this.windowDocuments) documents.add(doc);
    return documents;
  }

  load() {
    for (const module of this.modules) {
      const controller = module.createController(this.plugin, this, module);
      this.controllers.set(module.id, controller);
      controller.start();
    }
    const workspace = this.plugin.app.workspace;
    this.plugin.registerEvent(workspace.on("layout-change", () => this.refreshWithNotice()));
    this.plugin.registerEvent(workspace.on("window-open", (win) => {
      this.closedDocuments.delete(win.doc);
      this.windowDocuments.add(win.doc);
      this.refreshWithNotice();
    }));
    this.plugin.registerEvent(workspace.on("window-close", (win) => {
      this.closedDocuments.add(win.doc);
      this.windowDocuments.delete(win.doc);
      this.refreshWithNotice();
    }));
    this.watchDocuments();
    this.plugin.register(() => this.unload());
  }

  watchDocuments() {
    const documents = this.getDocuments();
    for (const [doc, observer] of this.documents) {
      if (!documents.has(doc)) {
        observer?.disconnect();
        this.documents.delete(doc);
      }
    }
    const selector = this.modules.map((module) => module.rootSelector).join(", ");
    for (const doc of documents) {
      if (this.documents.has(doc)) continue;
      const Observer = doc.defaultView?.MutationObserver || globalThis.MutationObserver;
      const observer = Observer && doc.body ? new Observer((records) => {
        // Discover modal/portal roots even when no workspace leaf changed.
        // Ignore text and ordinary card edits; root controllers handle those.
        const relevant = records.some((record) =>
          [...record.addedNodes, ...record.removedNodes].some((node) =>
            node.nodeType === 1 && (node.matches?.(selector) || node.querySelector?.(selector))
          )
        );
        if (!relevant || this.pendingRefresh !== null) return;
        this.pendingRefresh = setTimeout(() => {
          this.pendingRefresh = null;
          this.refreshWithNotice();
        }, 40);
      }) : null;
      observer?.observe(doc.body, { childList: true, subtree: true });
      this.documents.set(doc, observer);
    }
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
    this.watchDocuments();
    for (const controller of this.controllers.values()) controller.refresh(profile);
  }

  refreshWithNotice() {
    try {
      const profile = this.plugin.profileManager.getActiveProfile();
      this.plugin.themeEngine?.apply(profile);
      this.refresh(profile);
    } catch (error) {
      console.error("Customization Studio failed to update module styles after a workspace change.", error);
      this.plugin.notifyUser(`Customization Studio could not update a module: ${error.message}`);
    }
  }

  unload() {
    if (this.pendingRefresh !== null) clearTimeout(this.pendingRefresh);
    this.pendingRefresh = null;
    for (const observer of this.documents.values()) observer?.disconnect();
    this.documents.clear();
    this.windowDocuments.clear();
    for (const controller of this.controllers.values()) controller.unload();
    this.controllers.clear();
  }
}

module.exports = { MODULES, ModuleManager };
