const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { MODULES } = require("./module-manager");

class CustomizationSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.importText = "";
    this.newProfileName = "";
    this.renameValue = "";
    this.profilePreview = null;
  }

  display() {
    this.displayInto(this.containerEl);
  }

  displayInto(containerEl) {
    this.renderTarget = containerEl;
    containerEl.empty();
    containerEl.addClass("customization-studio-settings");
    containerEl.createEl("h2", { text: "Customization Studio" });
    containerEl.createEl("p", {
      text: "Visual profiles for Kanban, Spaced Repetition, and Obsidian Bases. Settings preview immediately and save automatically."
    });

    this.displayProfileSettings(containerEl);
    this.displayGlobalSettings(containerEl);
    this.displayModules(containerEl);
  }

  releaseDisplayTarget(containerEl) {
    if (this.renderTarget === containerEl) this.renderTarget = null;
  }

  refreshDisplay() {
    this.displayInto(this.renderTarget || this.containerEl);
  }

  displayProfileSettings(containerEl) {
    const active = this.plugin.profileManager.getActiveProfile();
    const isCustom = this.plugin.profileManager.customProfiles.some((profile) => profile.id === active.id);
    const section = containerEl.createEl("details", { cls: "cs-section", attr: { open: true } });
    section.createEl("summary", { text: "Profiles" });
    const preview = section.createEl("div", {
      cls: "cs-profile-preview",
      attr: { "aria-label": `Active profile: ${active.name}` }
    });
    preview.createEl("h3", { text: active.name });
    preview.createEl("p", { text: active.description || "No profile description." });
    const swatches = preview.createEl("div", {
      cls: "cs-profile-swatches",
      attr: { "aria-label": "Profile color preview" }
    });
    for (const [label, value] of [
      ["Accent", active.variables.accentColor],
      ["Surface", active.variables.surfaceColor],
      ["Text", active.variables.textColor],
      ["Tab gradient", active.variables.tabBarGradientColor]
    ]) {
      const swatch = swatches.createEl("span", { cls: "cs-profile-swatch" });
      swatch.setAttribute("title", `${label}: ${value}`);
      swatch.setAttribute("aria-label", `${label}: ${value}`);
      swatch.style.backgroundColor = value;
      swatch.dataset.profileColor = label;
    }
    const enabledModules = MODULES
      .filter((module) => active.moduleEnabled[module.id] !== false)
      .map((module) => module.name);
    const moduleSummary = preview.createEl("p", {
      cls: "cs-profile-modules",
      text: enabledModules.length ? `Enabled modules: ${enabledModules.join(", ")}` : "No modules enabled."
    });
    this.profilePreview = { swatches: [...swatches.children], moduleSummary };

    new Setting(section)
      .setName("Active profile")
      .setDesc(`Currently active: ${active.name}. Switching applies the profile immediately.`)
      .addDropdown((dropdown) => {
        for (const profile of this.plugin.profileManager.getProfiles()) {
          dropdown.addOption(profile.id, profile.name);
        }
        dropdown.setValue(active.id).onChange((id) => this.runChange(async () => {
          this.plugin.profileManager.setActiveProfile(id);
          await this.persistChange();
          this.refreshDisplay();
          new Notice(`Customization Studio: applied "${this.plugin.profileManager.getActiveProfile().name}".`);
        }));
      });

    new Setting(section)
      .setName("New profile")
      .setDesc("Create a profile by copying the active profile.")
      .addText((text) => {
        text.setPlaceholder("Profile name").setValue(this.newProfileName);
        text.onChange((value) => { this.newProfileName = value; });
      })
      .addButton((button) => button
        .setButtonText("Create")
        .setCta()
        .onClick(() => this.runChange(async () => {
          this.plugin.profileManager.createCustomProfile(this.newProfileName);
          this.newProfileName = "";
          await this.persistChange();
          this.refreshDisplay();
        })));

    if (isCustom) {
      new Setting(section)
        .setName("Duplicate profile")
        .setDesc("Create an independent copy of the active profile.")
        .addButton((button) => button
          .setButtonText("Duplicate")
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.duplicateProfile(active.id);
            await this.persistChange();
            this.refreshDisplay();
          })));

      new Setting(section)
        .setName("Rename profile")
        .addText((text) => text
          .setPlaceholder(active.name)
          .setValue(this.renameValue || active.name)
          .onChange((value) => { this.renameValue = value; }))
        .addButton((button) => button
          .setButtonText("Rename")
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.renameCustomProfile(active.id, this.renameValue);
            this.renameValue = "";
            await this.persistChange();
            this.refreshDisplay();
          })));
    } else {
      new Setting(section)
        .setName("Customize built-in profile")
        .setDesc("Make an editable copy before changing its appearance or module settings.")
        .addButton((button) => button
          .setButtonText("Duplicate")
          .setCta()
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.createCustomProfile(`${active.name} custom`);
            await this.persistChange();
            this.refreshDisplay();
          })));
    }

    new Setting(section)
      .setName("Export profile")
      .setDesc("Copy the active profile as JSON, including all module settings.")
      .addButton((button) => button
        .setButtonText("Copy JSON")
        .onClick(() => this.runChange(async () => {
          if (!globalThis.navigator?.clipboard?.writeText) {
            throw new Error("Clipboard access is unavailable in this Obsidian environment.");
          }
          await globalThis.navigator.clipboard.writeText(
            this.plugin.profileManager.exportProfile(active.id)
          );
          new Notice("Customization Studio: profile JSON copied.");
        })));

    new Setting(section)
      .setName("Import profile")
      .setDesc("Paste profile JSON. Imported IDs are made unique automatically.")
      .addTextArea((text) => {
        text.setPlaceholder("Paste exported profile JSON").setValue(this.importText);
        text.inputEl.addClass("cs-code-input");
        text.onChange((value) => { this.importText = value; });
      })
      .addButton((button) => button
        .setButtonText("Import")
        .onClick(() => this.runChange(async () => {
          if (!this.importText.trim()) throw new Error("Paste profile JSON before importing.");
          const imported = this.plugin.profileManager.importProfile(this.importText);
          this.importText = "";
          await this.persistChange();
          this.refreshDisplay();
          new Notice(`Customization Studio: imported "${imported.name}".`);
        })));

    if (isCustom) {
      new Setting(section)
        .setName("Delete profile")
        .setDesc("Switches to Minimal if this is the active profile.")
        .addButton((button) => button
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.deleteCustomProfile(active.id);
            await this.persistChange();
            this.refreshDisplay();
          })));
    }
  }

  displayGlobalSettings(containerEl) {
    const profile = this.plugin.profileManager.getActiveProfile();
    const section = containerEl.createEl("details", { cls: "cs-section", attr: { open: true } });
    section.createEl("summary", { text: "Global appearance" });
    if (!this.isCustom(profile)) {
      section.createEl("p", { text: "Duplicate the active built-in profile to edit its settings." });
      return;
    }

    this.addColorControl(section, "Accent color", profile.variables.accentColor || "#7c6ce7",
      (value) => this.updateProfile({ variables: { accentColor: value } }));
    this.addColorControl(section, "Surface color", profile.variables.surfaceColor || "#202020",
      (value) => this.updateProfile({ variables: { surfaceColor: value } }));
    this.addColorControl(section, "Text color", profile.variables.textColor || "#dddddd",
      (value) => this.updateProfile({ variables: { textColor: value } }));
    new Setting(section)
      .setName("Tab bar opacity")
      .setDesc("Transparency for the Obsidian tab bar only.")
      .addSlider((slider) => slider
        .setLimits(0, 100, 1)
        .setValue(profile.variables.tabBarOpacity)
        .setDynamicTooltip()
        .onChange((value) => this.updateProfile({
          variables: { tabBarOpacity: value }
        })));
    this.addColorControl(section, "Tab bar gradient color", profile.variables.tabBarGradientColor,
      (value) => this.updateProfile({ variables: { tabBarGradientColor: value } }));
    new Setting(section)
      .setName("Tab bar gradient direction")
      .setDesc("Choose the direction of the tab bar's color gradient.")
      .addDropdown((dropdown) => {
        for (const direction of [
          "to right", "to left", "to bottom", "to top",
          "to bottom right", "to bottom left", "to top right", "to top left"
        ]) {
          dropdown.addOption(direction, direction);
        }
        dropdown.setValue(profile.variables.tabBarGradientDirection)
          .onChange((value) => this.updateProfile({ variables: { tabBarGradientDirection: value } }));
      });
    new Setting(section)
      .setName("Tab bar gradient intensity")
      .setDesc("Set the gradient opacity. Zero disables the gradient.")
      .addSlider((slider) => slider
        .setLimits(0, 100, 1)
        .setValue(profile.variables.tabBarGradientIntensity)
        .setDynamicTooltip()
        .onChange((value) => this.updateProfile({
          variables: { tabBarGradientIntensity: value }
        })));
    new Setting(section)
      .setName("Reset global appearance")
      .setDesc("Restores global colors and tab bar appearance to Minimal defaults.")
      .addButton((button) => button
        .setButtonText("Reset")
        .onClick(() => this.updateProfile({
          variables: this.plugin.profileManager.builtInProfiles[0].variables,
          replaceVariables: true
        }, true)));

    const advanced = section.createEl("details", { cls: "cs-subsection" });
    advanced.createEl("summary", { text: "Advanced global CSS" });
    advanced.createEl("p", { text: "Advanced rules can affect any matching Obsidian interface element." });
    new Setting(advanced)
      .setName("Profile CSS")
      .addTextArea((text) => {
        text.setPlaceholder("Optional profile-wide CSS").setValue(profile.customCss);
        text.inputEl.addClass("cs-code-input");
        text.inputEl.addEventListener("blur", () => this.updateProfile({ customCss: text.getValue() }));
      });
  }

  displayModules(containerEl) {
    const profile = this.plugin.profileManager.getActiveProfile();
    const section = containerEl.createEl("details", { cls: "cs-section", attr: { open: true } });
    section.createEl("summary", { text: "Plugin modules" });
    if (!this.isCustom(profile)) {
      section.createEl("p", { text: "Duplicate the active built-in profile to configure modules." });
      return;
    }

    for (const module of MODULES) {
      this.displayModule(section, module, profile);
    }
  }

  displayModule(containerEl, module, profile) {
    const detected = this.plugin.moduleManager.isTargetPluginEnabled(module);
    const section = containerEl.createEl("details", { cls: "cs-module-section" });
    section.createEl("summary", { text: module.name });
    section.createEl("p", {
      text: detected
        ? "Target detected. Styling applies when a matching view is open."
        : module.target.type === "core"
          ? "Obsidian Core Plugin is not enabled or its API is unavailable."
          : "Community plugin is not enabled."
    });

    new Setting(section)
      .setName("Enable customization")
      .setDesc("Turning this off removes this module's styles and observers.")
      .addToggle((toggle) => toggle
        .setValue(profile.moduleEnabled[module.id] !== false)
        .onChange((value) => this.runChange(async () => {
          this.plugin.profileManager.setModuleEnabled(module.id, value);
          await this.persistChange();
          this.refreshProfilePreview();
        })));

    for (const group of module.controlGroups) {
      const groupEl = section.createEl("details", { cls: "cs-subsection", attr: { open: true } });
      groupEl.createEl("summary", { text: group.name });
      for (const control of group.controls) {
        this.displayControl(groupEl, module, profile, control);
      }
      if (module.id === "kanban" && group.name === "Columns") {
        this.displayColumnOverrides(groupEl, module, profile);
      }
    }

    const advanced = section.createEl("details", { cls: "cs-subsection" });
    advanced.createEl("summary", { text: "Advanced scoped CSS" });
    advanced.createEl("p", {
      text: `CSS selectors are scoped under ${module.selectors.root}. @import and global at-rules are rejected.`
    });
    new Setting(advanced)
      .setName("Module CSS")
      .addTextArea((text) => {
        text.setPlaceholder("Optional module-specific CSS").setValue(profile.modules[module.id].customCss);
        text.inputEl.addClass("cs-code-input");
        text.inputEl.addEventListener("blur", () => this.updateModule(module.id, {
          customCss: text.getValue()
        }));
      });

    new Setting(section)
      .setName("Reset module settings")
      .setDesc("Restores this module's visual settings to their defaults.")
      .addButton((button) => button
        .setButtonText("Reset")
        .setWarning()
        .onClick(() => this.runChange(async () => {
          this.plugin.profileManager.updateActiveProfile({
            modules: { [module.id]: module.defaultSettings }
          });
          await this.persistChange();
          this.refreshDisplay();
        })));
  }

  displayControl(containerEl, module, profile, control) {
    const value = profile.modules[module.id][control.key];
    const schema = module.settingsSchema[control.key];
    const setting = new Setting(containerEl).setName(control.name);
    if (control.desc) setting.setDesc(control.desc);
    else if (control.unit) setting.setDesc(`Current value: ${value}${control.unit}`);
    const update = (next) => this.updateModule(module.id, { [control.key]: next });
    if (control.type === "color") {
      setting.addColorPicker((picker) => picker.setValue(value).onChange(update));
    } else if (control.type === "boolean") {
      setting.addToggle((toggle) => toggle.setValue(value).onChange(update));
    } else if (control.type === "range") {
      setting.addSlider((slider) => slider
        .setLimits(schema.min, schema.max, schema.step || 1)
        .setValue(value)
        .setDynamicTooltip()
        .onChange(update));
    } else if (control.type === "select") {
      setting.addDropdown((dropdown) => {
        for (const option of schema.options) dropdown.addOption(option, option);
        dropdown.setValue(value).onChange(update);
      });
    } else if (control.type === "text") {
      setting.addText((text) => {
        text.setPlaceholder("Assets/cover.jpg or https://example.com/cover.jpg").setValue(value);
        text.inputEl.type = "text";
        text.inputEl.addEventListener("blur", () => update(text.getValue().trim()));
      });
    }
  }

  displayColumnOverrides(containerEl, module, profile) {
    const names = this.plugin.moduleManager.getDetectedColumns(module.id);
    containerEl.createEl("p", {
      text: names.length
        ? "Optional manual colors override automatic matching for these current columns."
        : "Open a Kanban board, then reopen settings to add per-column color overrides."
    });
    for (const name of names) {
      const colors = profile.modules[module.id].columnColors;
      new Setting(containerEl)
        .setName(name)
        .addColorPicker((picker) => picker
          .setValue(colors[name] || this.plugin.profileManager.getActiveProfile().variables.accentColor || "#7c6ce7")
          .onChange((value) => this.updateModule(module.id, {
            columnColors: { ...colors, [name]: value }
          })))
        .addButton((button) => button
          .setButtonText("Clear")
          .onClick(() => {
            const next = { ...colors };
            delete next[name];
            this.updateModule(module.id, { columnColors: next });
          }));
    }
  }

  addColorControl(containerEl, name, value, onChange) {
    new Setting(containerEl).setName(name).addColorPicker((picker) => picker
      .setValue(value)
      .onChange(onChange));
  }

  isCustom(profile) {
    return this.plugin.profileManager.customProfiles.some((item) => item.id === profile.id);
  }

  updateProfile(update, refreshAfter = false) {
    return this.runChange(async () => {
      this.plugin.profileManager.updateActiveProfile(update);
      await this.persistChange();
      if (refreshAfter) this.refreshDisplay();
      else this.refreshProfilePreview();
    });
  }

  updateModule(moduleId, update) {
    return this.runChange(async () => {
      this.plugin.profileManager.updateModuleSettings(moduleId, update);
      await this.persistChange();
      this.refreshProfilePreview();
    });
  }

  refreshProfilePreview() {
    if (!this.profilePreview) return;
    const profile = this.plugin.profileManager.getActiveProfile();
    const values = {
      Accent: profile.variables.accentColor,
      Surface: profile.variables.surfaceColor,
      Text: profile.variables.textColor,
      "Tab gradient": profile.variables.tabBarGradientColor
    };
    for (const swatch of this.profilePreview.swatches) {
      const label = swatch.dataset.profileColor;
      const value = values[label];
      swatch.style.backgroundColor = value;
      swatch.setAttribute("title", `${label}: ${value}`);
      swatch.setAttribute("aria-label", `${label}: ${value}`);
    }
    const enabledModules = MODULES
      .filter((module) => profile.moduleEnabled[module.id] !== false)
      .map((module) => module.name);
    this.profilePreview.moduleSummary.textContent = enabledModules.length
      ? `Enabled modules: ${enabledModules.join(", ")}`
      : "No modules enabled.";
  }

  async persistChange() {
    this.plugin.applyCustomization();
    await this.plugin.settingsManager.scheduleSave();
  }

  runChange(change) {
    return change().catch((error) => {
      console.error("Customization Studio could not apply or save the requested change.", error);
      new Notice(`Customization Studio: ${error.message}`);
    });
  }
}

module.exports = { CustomizationSettingTab };
