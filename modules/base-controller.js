class BaseModuleController {
  constructor(plugin, manager, module) {
    this.plugin = plugin;
    this.manager = manager;
    this.module = module;
    this.roots = new Map();
    this.style = null;
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
    if (profile.moduleEnabled[this.module.id] === false ||
        !this.manager.isTargetPluginEnabled(this.module)) {
      this.deactivate();
      return;
    }

    const container = this.plugin.app.workspace.containerEl;
    const roots = new Set(container.querySelectorAll(this.module.rootSelector));
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
    observer.observe(root, { childList: true, subtree: true, characterData: true });
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
    if (!this.style) {
      const doc = this.plugin.app.workspace.containerEl.ownerDocument;
      this.style = doc.createElement("style");
      this.style.dataset.customizationStudioModule = this.module.id;
      this.style.dataset.customizationStudioOwner = this.plugin.manifest.id;
      doc.head.appendChild(this.style);
    }
    this.style.textContent = `${this.module.styles(this.settings, this)}\n${this.module.customCss(this.settings, this)}`;
  }

  onRootsUpdated() {}

  onDomChanged() {}

  onRootRemoved() {}

  removeStyle() {
    if (this.style?.parentNode) this.style.remove();
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
