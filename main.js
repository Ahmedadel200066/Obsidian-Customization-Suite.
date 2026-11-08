const { Plugin } = require("obsidian");
const { SettingsManager } = require("./core/settings-manager");
const { ProfileManager } = require("./core/profile-manager");
const { ThemeEngine } = require("./core/theme-engine");
const { ModuleManager } = require("./core/module-manager");
const { CustomizationSettingTab } = require("./core/settings-tab");

module.exports = class CustomizationStudioPlugin extends Plugin {
  async onload() {
    this.settingsManager = new SettingsManager(this);
    await this.settingsManager.load();

    this.profileManager = new ProfileManager(this.settingsManager);
    this.profileManager.load();

    this.themeEngine = new ThemeEngine(this);
    this.moduleManager = new ModuleManager(this);
    this.moduleManager.load();
    await this.themeEngine.loadCoreCss();

    this.addSettingTab(new CustomizationSettingTab(this.app, this));
    this.applyCustomization();
    this.app.workspace.onLayoutReady(() => this.moduleManager.refresh());
  }

  applyCustomization() {
    const profile = this.profileManager.getActiveProfile();
    this.themeEngine.apply(profile);
    this.moduleManager.refresh(profile);
  }

  async saveCustomization() {
    await this.settingsManager.save();
    this.applyCustomization();
  }

  onunload() {
    this.themeEngine?.unload();
    this.moduleManager?.unload();
  }
};
