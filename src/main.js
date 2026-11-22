const { Plugin, Notice } = require("obsidian");
const { SettingsManager } = require("../core/settings-manager");
const { ProfileManager } = require("../core/profile-manager");
const { ThemeEngine } = require("../core/theme-engine");
const { ModuleManager } = require("../core/module-manager");
const { PresentationManager } = require("../core/presentation-manager");
const { CustomizationSettingTab } = require("../core/settings-tab");
const { CustomizationStudioModal } = require("../core/settings-modal");

module.exports = class CustomizationStudioPlugin extends Plugin {
  notifyUser(message) {
    new Notice(message);
  }

  async onload() {
    try {
      this.settingsManager = new SettingsManager(this);
      await this.settingsManager.load();

      this.profileManager = new ProfileManager(this.settingsManager);
      this.profileManager.load();
      this.presentation=new PresentationManager(this);
      const initialized=await this.presentation.load();
      this.profileManager.presentation=this.presentation;
      if(initialized)await this.settingsManager.save();

      this.themeEngine = new ThemeEngine(this);
      await this.themeEngine.loadCoreCss();

      this.moduleManager = new ModuleManager(this);
      this.moduleManager.load();
      this.settingsTab = new CustomizationSettingTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      this.register(() => this.settingsTab.dispose());
      this.settingsModal = new CustomizationStudioModal(this.app, this.settingsTab);
      this.registerCustomizationEntryPoints();
      this.watchAppearance();
      this.applyCustomization();
      this.app.workspace.onLayoutReady(() => this.moduleManager.refreshWithNotice());
    } catch (error) {
      console.error("Customization Studio failed to start.", error);
      new Notice(`Customization Studio failed to start: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  applyCustomization() {
    if(this.unloading)return;
    if (this.settingsManager.settings.customizationEnabled === false) {
      this.moduleManager.pause();
      this.themeEngine.pause();
      this.queueLiveRefresh(true);
      return;
    }
    const meta=this.presentation?.meta();
    if(meta?.neutral&&meta.mode==="auto"){
      if(this.themeEngine.appliedProfileId&&this.themeEngine.appliedProfileId!==this.settingsManager.settings.activeProfileId)this.themeEngine.pause();
      this.presentation.refreshInheritedPalette();
    }
    const profile = this.profileManager.getActiveProfile();
    this.themeEngine.apply(profile);
    this.moduleManager.refresh(profile);
    if(this.presentation?.pendingShapeTarget){this.presentation.pendingShapeTarget=false;this.moduleManager.controllers?.get("bases")?.autoSelectShapeTarget?.();}
    this.queueLiveRefresh();
  }

  queueLiveRefresh(force=false) {
    if(!this.app?.workspace?.trigger)return;
    if(this.liveRefreshTimer!==undefined&&this.liveRefreshTimer!==null)clearTimeout(this.liveRefreshTimer);
    this.liveRefreshTimer=setTimeout(()=>{
      this.liveRefreshTimer=null;if(this.unloading||(!force&&this.settingsManager.settings.customizationEnabled===false))return;
      const bases=this.moduleManager.controllers?.get("bases"),target=bases?.shapeTarget;
      this.broadcastingCssChange=true;
      try{this.app.workspace.trigger?.("css-change");this.app.workspace.trigger?.("resize");}
      finally{this.broadcastingCssChange=false;}
      // A native CSS remeasurement may rebuild its card group, not the pane.
      if(target&&bases.shapeTarget===target&&bases.roots.has(target.root)){
        const group=target.root.querySelector(".bases-cards-group");
        if(group)target.group=group;
        bases.syncShapeTarget();bases.updateStyle();
      }
    },16);
  }

  watchAppearance() {
    this.lastHostMode=this.presentation.hostMode();
    const changed=()=>{
      if(this.unloading||this.broadcastingCssChange||this.settingsManager.settings.customizationEnabled===false)return;
      const mode=this.presentation.hostMode();if(mode===this.lastHostMode)return;
      this.lastHostMode=mode;this.themeEngine.pause();this.applyCustomization();this.settingsTab?.refreshAllViews();
    };
    const doc=this.app.workspace.containerEl.ownerDocument,Observer=doc.defaultView?.MutationObserver;
    if(Observer){const observer=new Observer(changed);observer.observe(doc.body,{attributes:true,attributeFilter:["class"]});this.register(()=>observer.disconnect());}
    this.registerEvent(this.app.workspace.on("css-change",changed));
    const media=doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)");media?.addEventListener?.("change",changed);this.register(()=>media?.removeEventListener?.("change",changed));
  }

  async setCustomizationEnabled(enabled) {
    if (typeof enabled !== "boolean") throw new Error("Customization state must be a boolean.");
    this.settingsManager.settings.customizationEnabled = enabled;
    this.applyCustomization();
    this.settingsTab?.refreshAllViews();
    await this.settingsManager.scheduleSave();
  }

  async saveCustomization() {
    this.applyCustomization();
    return this.settingsManager.scheduleSave();
  }

  openCustomizationSettings() {
    this.settingsModal.open();
  }

  registerCustomizationEntryPoints() {
    this.register(() => this.settingsModal.close());
    const ribbonIcon = this.addRibbonIcon(
      "paintbrush",
      "Open Customization Studio settings",
      () => this.openCustomizationSettings()
    );
    this.register(() => ribbonIcon.remove());
  }

  cleanup() {
    this.unloading=true;
    if(this.liveRefreshTimer!==undefined&&this.liveRefreshTimer!==null)clearTimeout(this.liveRefreshTimer);
    this.liveRefreshTimer=null;
    this.moduleManager?.unload();
    this.themeEngine?.unload();
    this.app?.workspace?.trigger?.("css-change");
    this.app?.workspace?.trigger?.("resize");
  }

  async onunload() {
    let saveError;
    try {
      this.settingsModal?.close();
      await this.settingsTab?.flushLiveInputs?.();
      if (this.settingsTab?.captureViewState()) await this.settingsManager?.save();
      await this.settingsManager?.flush();
    } catch (error) {
      saveError = error;
      console.error("Customization Studio could not persist its latest settings during unload.", error);
      new Notice(`Customization Studio could not save the latest settings: ${error.message}`);
    } finally {
      this.settingsManager?.settleWaiters(saveError);
      this.cleanup();
    }
  }
};
