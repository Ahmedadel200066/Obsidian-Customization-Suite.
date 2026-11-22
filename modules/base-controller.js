const { selectiveStyles } = require("../core/selective-styles");

class BaseModuleController {
  constructor(plugin, manager, module) {
    this.plugin = plugin;
    this.manager = manager;
    this.module = module;
    this.roots = new Map();
    this.style = null;
    this.styles = new Map();
    this.profile = null;
    this.settings = module.validateSettings();
    this.pendingApply = null;
  }

  start() {
    this.refresh(this.plugin.profileManager.getActiveProfile());
  }

  refresh(profile) {
    this.profile = profile;
    this.settings = this.module.validateSettings(profile.modules[this.module.id]);
    if (this.plugin.settingsManager?.settings.customizationEnabled === false ||
        profile.moduleEnabled[this.module.id] === false ||
        !this.manager.isTargetPluginEnabled(this.module)) {
      this.deactivate();
      return;
    }

    const container = this.plugin.app.workspace.containerEl;
    const documents = this.manager.getDocuments?.() || new Set([container.ownerDocument]);
    const roots = new Set();
    for (const doc of documents) {
      for (const root of doc.body.querySelectorAll(this.module.rootSelector)) roots.add(root);
    }
    // The workspace may be a detached container during startup (and in host tests).
    for (const root of container.querySelectorAll(this.module.rootSelector)) roots.add(root);
    for (const [root, observer] of this.roots) {
      if (!roots.has(root)) {
        observer?.disconnect();
        this.roots.delete(root);
        this.onRootRemoved(root);
      }
    }
    for (const root of roots) {
      if (!this.roots.has(root)) this.observeRoot(root);
    }

    if (roots.size === 0) {
      this.removeStyle();
      return;
    }
    this.onRootsUpdated(roots);
    this.updateStyle();
  }

  observeRoot(root) {
    const Observer = root.ownerDocument.defaultView?.MutationObserver || globalThis.MutationObserver;
    if (!Observer) {
      this.roots.set(root, null);
      return;
    }
    const observer = new Observer(() => this.scheduleApply(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "src"] });
    this.roots.set(root, observer);
  }

  scheduleApply(root) {
    if (this.pendingApply !== null) return;
    this.pendingApply = setTimeout(() => {
      this.pendingApply = null;
      if (!this.roots.has(root)) return;
      this.onDomChanged(root);
      this.updateStyle();
    }, 40);
  }

  updateStyle() {
    const documents = new Set([...this.roots.keys()].map((root) => root.ownerDocument));
    for (const [doc, style] of this.styles) {
      if (!documents.has(doc)) {
        style.remove();
        this.styles.delete(doc);
      }
    }
    const keys=this.profile?.studio?.moduleKeys[this.module.id]||[];
    const base=this.profile?.studio?.neutral ? selectiveStyles(this.module,this.settings,this,keys) : this.module.styles(this.settings,this);
    const css = `${base}\n${this.module.customCss(this.settings, this)}\n${this.additionalStyles?.()||""}`;
    for (const doc of documents) {
      let style = this.styles.get(doc);
      if (!style?.parentNode) {
        style = doc.createElement("style");
        style.dataset.customizationStudioModule = this.module.id;
        style.dataset.customizationStudioOwner = this.plugin.manifest.id;
        doc.head.appendChild(style);
        this.styles.set(doc, style);
      }
      if (style.textContent !== css) style.textContent = css;
    }
    this.style = this.styles.get(this.plugin.app.workspace.containerEl.ownerDocument)
      || this.styles.values().next().value || null;
  }

  onRootsUpdated() {}

  onDomChanged() {}

  onRootRemoved() {}

  removeStyle() {
    for (const style of this.styles.values()) if (style.parentNode) style.remove();
    this.styles.clear();
    this.style = null;
  }

  deactivate() {
    if (this.pendingApply !== null) {
      clearTimeout(this.pendingApply);
      this.pendingApply = null;
    }
    for (const [root, observer] of this.roots) {
      observer?.disconnect();
      this.onRootRemoved(root);
    }
    this.roots.clear();
    this.removeStyle();
  }

  unload() {
    this.deactivate();
  }
}

module.exports = { BaseModuleController };
