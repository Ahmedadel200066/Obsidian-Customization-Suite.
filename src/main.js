const { Plugin, Notice } = require("obsidian");
const { SettingsManager } = require("../core/settings-manager");
const { ProfileManager } = require("../core/profile-manager");
const { ThemeEngine } = require("../core/theme-engine");
const { ModuleManager } = require("../core/module-manager");
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
      if (this.profileManager.load()) await this.settingsManager.save();

      this.themeEngine = new ThemeEngine(this);
      await this.themeEngine.loadCoreCss();

      this.moduleManager = new ModuleManager(this);
      this.moduleManager.load();
      this.settingsTab = new CustomizationSettingTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      this.register(() => this.settingsTab.dispose());
      this.settingsModal = new CustomizationStudioModal(this.app, this.settingsTab);
      this.registerCustomizationEntryPoints();
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
    const profile = this.profileManager.getActiveProfile();
    this.themeEngine.apply(profile);
    this.moduleManager.refresh(profile);
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
    this.moduleManager?.unload();
    this.themeEngine?.unload();
  }

  async onunload() {
    let saveError;
    try {
      this.settingsModal?.close();
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
