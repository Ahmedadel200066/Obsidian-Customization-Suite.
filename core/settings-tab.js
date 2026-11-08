const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { MODULES } = require("./module-manager");

class CustomizationSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("customization-studio-settings");
    containerEl.createEl("h2", { text: "Customization Studio" });
    containerEl.createEl("p", {
      text: "Switch profiles, adjust core appearance, and add CSS for enabled plugin modules."
    });

    new Setting(containerEl)
      .setName("Active profile")
      .setDesc("Built-in profiles are read-only. Create a custom copy to edit its appearance.")
      .addDropdown((dropdown) => {
        for (const profile of this.plugin.profileManager.getProfiles()) {
          dropdown.addOption(profile.id, profile.name);
        }
        dropdown
          .setValue(this.plugin.profileManager.getActiveProfile().id)
          .onChange((id) => this.runChange(async () => {
            this.plugin.profileManager.setActiveProfile(id);
            await this.plugin.saveCustomization();
            this.display();
          }));
      });

    const activeProfile = this.plugin.profileManager.getActiveProfile();
    new Setting(containerEl)
      .setName("Create custom profile")
      .setDesc("Copy the active profile and make the copy editable.")
      .addText((text) => {
        this.newProfileName = text;
        text.setPlaceholder("Profile name");
      })
      .addButton((button) => button
        .setButtonText("Create")
        .setCta()
        .onClick(() => this.runChange(async () => {
          this.plugin.profileManager.createCustomProfile(this.newProfileName.getValue());
          await this.plugin.saveCustomization();
          this.display();
        })));

    if (!this.plugin.profileManager.customProfiles.some((profile) => profile.id === activeProfile.id)) {
      containerEl.createEl("p", { text: "Create a custom profile to enable the editor controls below." });
      this.displayModuleSettings(containerEl, activeProfile, false);
      return;
    }

    new Setting(containerEl).setName("Accent color").addColorPicker((picker) => picker
      .setValue(activeProfile.variables.accentColor || "#7c6ce7")
      .onChange((value) => this.updateVariable("accentColor", value)));

    new Setting(containerEl).setName("Surface color").addColorPicker((picker) => picker
      .setValue(activeProfile.variables.surfaceColor || "#202020")
      .onChange((value) => this.updateVariable("surfaceColor", value)));

    new Setting(containerEl).setName("Text color").addColorPicker((picker) => picker
      .setValue(activeProfile.variables.textColor || "#dddddd")
      .onChange((value) => this.updateVariable("textColor", value)));

    new Setting(containerEl).setName("Border radius")
      .setDesc("Pixels, from 0 to 999.")
      .addText((text) => text
        .setPlaceholder("8px")
        .setValue(activeProfile.variables.borderRadius || "8px")
        .onChange((value) => {
          if (!/^(0|[1-9]\d{0,2})px$/.test(value)) return;
          this.updateVariable("borderRadius", value);
        }));

    new Setting(containerEl).setName("Custom CSS")
      .setDesc("Profile-wide CSS. Prefer stable Obsidian selectors and test after updates.")
      .addTextArea((text) => text
        .setPlaceholder("/* Profile-wide rules */")
        .setValue(activeProfile.customCss)
        .onChange((value) => this.updateProfile({ customCss: value })));

    this.displayModuleSettings(containerEl, activeProfile, true);

    if (this.plugin.profileManager.customProfiles.some((profile) => profile.id === activeProfile.id)) {
      new Setting(containerEl)
        .setName("Delete custom profile")
        .setDesc("The profile is removed from this plugin's saved settings.")
        .addButton((button) => button
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.deleteCustomProfile(activeProfile.id);
            await this.plugin.saveCustomization();
            this.display();
          })));
    }
  }

  displayModuleSettings(containerEl, profile, editable) {
    containerEl.createEl("h3", { text: "Plugin modules" });
    for (const module of MODULES) {
      const enabled = this.plugin.moduleManager.isEnabled(module.id);
      const installed = this.plugin.moduleManager.isTargetPluginEnabled(module);
      new Setting(containerEl)
        .setName(module.name)
        .setDesc(`${module.level} - ${installed ? "Target plugin enabled" : "Target plugin not detected"}`)
        .addToggle((toggle) => toggle
          .setValue(enabled)
          .onChange((value) => this.runChange(async () => {
            this.plugin.moduleManager.setEnabled(module.id, value);
            await this.plugin.saveCustomization();
          })));
      if (editable) {
        new Setting(containerEl)
          .setName(`${module.name} CSS`)
          .setDesc(`Injected only while ${module.name} is enabled and detected.`)
          .addTextArea((text) => text
            .setPlaceholder(`/* CSS for ${module.name}; target its own stable selectors */`)
            .setValue(profile.moduleCss[module.id] || "")
            .onChange((value) => this.updateModuleCss(module.id, value)));
      }
    }
  }

  updateProfile(update) {
    this.runChange(async () => {
      const activeProfile = this.plugin.profileManager.getActiveProfile();
      this.plugin.profileManager.updateActiveProfile({
        ...activeProfile,
        ...update,
        variables: { ...activeProfile.variables, ...(update.variables || {}) },
        moduleCss: { ...activeProfile.moduleCss, ...(update.moduleCss || {}) }
      });
      await this.plugin.saveCustomization();
    });
  }

  updateVariable(key, value) {
    const activeProfile = this.plugin.profileManager.getActiveProfile();
    this.updateProfile({ variables: { ...activeProfile.variables, [key]: value } });
  }

  updateModuleCss(moduleId, css) {
    const activeProfile = this.plugin.profileManager.getActiveProfile();
    this.updateProfile({ moduleCss: { ...activeProfile.moduleCss, [moduleId]: css } });
  }

  runChange(change) {
    return change().catch((error) => {
      console.error("Customization Studio could not save the requested change.", error);
      new Notice(`Customization Studio: ${error.message}`);
    });
  }
}

module.exports = { CustomizationSettingTab };
