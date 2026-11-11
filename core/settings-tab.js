const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { MODULES } = require("./module-manager");

class CustomizationSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.importText = "";
    this.newProfileName = "";
    this.renameValue = "";
    this.viewContexts = new WeakMap();
    this.openViews = new Set();
    this.viewSaveTimers = new Set();
  }

  display() {
    this.displayInto(this.containerEl, "settingsTab");
  }

  displayInto(containerEl, viewKey = "settingsTab") {
    let context = this.viewContexts.get(containerEl);
    if (!context) {
      const saved = this.plugin.settingsManager.settings.uiState[viewKey];
      context = {
        containerEl,
        viewKey,
        section: saved.section,
        moduleId: saved.moduleId,
        scrollTop: saved.scrollTop,
        preview: null,
        saveTimer: null,
        scrollHandler: null
      };
      context.scrollHandler = () => {
        context.scrollTop = containerEl.scrollTop;
        this.plugin.settingsManager.settings.uiState[viewKey] = {
          section: context.section,
          moduleId: context.moduleId,
          scrollTop: context.scrollTop
        };
        this.scheduleViewStateSave(context);
      };
      containerEl.addEventListener("scroll", context.scrollHandler, { passive: true });
      this.viewContexts.set(containerEl, context);
      this.openViews.add(context);
    }

    containerEl.empty();
    containerEl.addClass("customization-studio-settings");
    const header = containerEl.createEl("header", { cls: "cs-settings-header" });
    header.createEl("h2", { text: "Customization Studio" });
    header.createEl("p", {
      text: "Visual profiles for Kanban, Spaced Repetition, and Obsidian Bases. Settings preview immediately and save automatically."
    });
    const activeProfile = this.plugin.profileManager.getActiveProfile();
    const profileHeader = header.createEl("div", {
      cls: "cs-active-profile-header",
      attr: { "aria-label": `Active profile: ${activeProfile.name}`, "aria-live": "polite" }
    });
    profileHeader.createEl("span", { cls: "cs-active-profile-badge", text: "ACTIVE PROFILE" });
    const profileName = profileHeader.createEl("strong", { text: activeProfile.name });
    const swatches = profileHeader.createEl("div", {
      cls: "cs-profile-swatches",
      attr: { "aria-label": "Active profile color preview" }
    });
    for (const [label, value] of [
      ["Accent", activeProfile.variables.accentColor],
      ["Surface", activeProfile.variables.surfaceColor],
      ["Text", activeProfile.variables.textColor],
      ["Tab gradient", activeProfile.variables.tabBarGradientColor]
    ]) {
      const swatch = swatches.createEl("span", { cls: "cs-profile-swatch" });
      swatch.dataset.profileColor = label;
      swatch.setAttribute("title", `${label}: ${value}`);
      swatch.setAttribute("aria-label", `${label}: ${value}`);
      swatch.style.backgroundColor = value;
    }
    const enabledModules = MODULES
      .filter((module) => activeProfile.moduleEnabled[module.id] !== false)
      .map((module) => module.name);
    const moduleSummary = profileHeader.createEl("span", {
      cls: "cs-profile-modules",
      text: enabledModules.length ? `Enabled: ${enabledModules.join(", ")}` : "No modules enabled"
    });
    context.preview = { name: profileName, swatches: [...swatches.children], moduleSummary };

    const navigation = containerEl.createEl("div", {
      cls: "cs-primary-tabs",
      attr: { role: "tablist", "aria-label": "Customization Studio settings" }
    });
    const panel = containerEl.createEl("section", {
      cls: "cs-primary-panel",
      attr: {
        role: "tabpanel",
        tabindex: "0",
        id: `cs-${context.viewKey}-panel`,
        "aria-labelledby": `cs-${context.viewKey}-tab-${context.section}`
      }
    });
    context.panel = panel;
    const tabs = [
      ["global", "Global Appearance"],
      ["profiles", "Profiles"],
      ["integrations", "Integrations"]
    ];
    const tabElements = [];
    for (const [id, label] of tabs) {
      const tab = navigation.createEl("button", {
        text: label,
        attr: {
          type: "button",
          role: "tab",
          "aria-selected": String(context.section === id),
          tabindex: context.section === id ? "0" : "-1",
          "aria-controls": `cs-${context.viewKey}-panel`
        }
      });
      tabElements.push(tab);
      tab.setAttribute("id", `cs-${context.viewKey}-tab-${id}`);
      if (context.section === id) tab.addClass("is-active");
      tab.addEventListener("click", () => {
        this.setViewState(context, { section: id });
        this.refreshDisplay(context);
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = tabs.findIndex(([tabId]) => tabId === id);
        const nextIndex = event.key === "Home" ? 0
          : event.key === "End" ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        context.focusPrimaryTab = nextIndex;
        this.setViewState(context, { section: tabs[nextIndex][0] });
        this.refreshDisplay(context);
      });
    }
    if (context.focusPrimaryTab !== undefined) {
      tabElements[context.focusPrimaryTab]?.focus();
      delete context.focusPrimaryTab;
    }

    if (context.section === "global") {
      panel.setAttribute("aria-label", "Global Appearance");
      this.displayGlobalSettings(panel, context);
    } else if (context.section === "profiles") {
      panel.setAttribute("aria-label", "Profiles");
      this.displayProfileSettings(panel, context);
    } else {
      panel.setAttribute("aria-label", "Integrations");
      this.displayModules(panel, context);
    }
    containerEl.scrollTop = context.scrollTop;
  }

  releaseDisplayTarget(containerEl) {
    const context = this.viewContexts.get(containerEl);
    if (!context) return;
    context.scrollTop = containerEl.scrollTop;
    containerEl.removeEventListener("scroll", context.scrollHandler);
    if (context.saveTimer) {
      clearTimeout(context.saveTimer);
      this.viewSaveTimers.delete(context.saveTimer);
      context.saveTimer = null;
    }
    this.persistViewState(context);
    this.viewContexts.delete(containerEl);
    this.openViews.delete(context);
  }

  dispose() {
    this.captureViewState();
    for (const context of this.openViews) {
      context.containerEl.removeEventListener("scroll", context.scrollHandler);
      if (context.saveTimer) clearTimeout(context.saveTimer);
    }
    this.openViews.clear();
    for (const timer of this.viewSaveTimers) clearTimeout(timer);
    this.viewSaveTimers.clear();
  }

  captureViewState() {
    let pending = false;
    for (const context of this.openViews) {
      const state = {
        section: context.section,
        moduleId: context.moduleId,
        scrollTop: context.containerEl.scrollTop
      };
      context.scrollTop = state.scrollTop;
      const previous = this.plugin.settingsManager.settings.uiState[context.viewKey];
      if (JSON.stringify(previous) !== JSON.stringify(state) || context.saveTimer) pending = true;
      this.plugin.settingsManager.settings.uiState[context.viewKey] = state;
    }
    return pending;
  }

  refreshDisplay(context) {
    if (context) this.displayInto(context.containerEl, context.viewKey);
  }

  refreshAllViews() {
    for (const context of this.openViews) this.refreshDisplay(context);
  }

  refreshOtherViews(currentContext) {
    for (const context of this.openViews) {
      if (context !== currentContext) this.refreshDisplay(context);
    }
  }

  setViewState(context, update) {
    Object.assign(context, update);
    this.plugin.settingsManager.settings.uiState[context.viewKey] = {
      section: context.section,
      moduleId: context.moduleId,
      scrollTop: context.scrollTop
    };
    this.scheduleViewStateSave(context);
  }

  scheduleViewStateSave(context) {
    if (context.saveTimer) {
      clearTimeout(context.saveTimer);
      this.viewSaveTimers.delete(context.saveTimer);
    }
    const timer = setTimeout(() => {
      this.viewSaveTimers.delete(timer);
      context.saveTimer = null;
      this.runChange(() => this.plugin.settingsManager.scheduleSave());
    }, 500);
    context.saveTimer = timer;
    this.viewSaveTimers.add(timer);
  }

  persistViewState(context) {
    this.plugin.settingsManager.settings.uiState[context.viewKey] = {
      section: context.section,
      moduleId: context.moduleId,
      scrollTop: context.scrollTop
    };
    this.runChange(() => this.plugin.settingsManager.scheduleSave());
  }

  displayProfileSettings(containerEl, context) {
    const active = this.plugin.profileManager.getActiveProfile();
    const isCustom = this.plugin.profileManager.customProfiles.some((profile) => profile.id === active.id);
    const section = containerEl.createEl("div", { cls: "cs-section" });
    section.createEl("h3", { text: "Profiles" });
    section.createEl("p", {
      text: `Editing profiles. The active profile is "${active.name}".`
    });
    section.createEl("p", {
      cls: "cs-suggestions-unavailable",
      text: "Suggested profiles are unavailable: this version does not define recommendation rules or verified theme-detection behavior."
    });

    new Setting(section)
      .setName("Active profile")
      .setDesc(`Currently active: ${active.name}. Switching applies the profile immediately.`)
      .addDropdown((dropdown) => {
        for (const profile of this.plugin.profileManager.getProfiles()) {
          dropdown.addOption(profile.id, profile.name);
        }
        dropdown.setValue(active.id).onChange((id) => this.runChange(async () => {
          this.plugin.profileManager.setActiveProfile(id);
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
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
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
        })));

    if (isCustom) {
      new Setting(section)
        .setName("Duplicate profile")
        .setDesc("Create an independent copy of the active profile.")
        .addButton((button) => button
          .setButtonText("Duplicate")
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.duplicateProfile(active.id);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
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
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
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
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
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
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
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
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
    }
  }

  displayGlobalSettings(containerEl, context) {
    const profile = this.plugin.profileManager.getActiveProfile();
    const section = containerEl.createEl("div", { cls: "cs-section" });
    section.createEl("h3", { text: "Global appearance" });
    if (!this.isCustom(profile)) {
      section.createEl("p", { text: "Duplicate the active built-in profile to edit its settings." });
      return;
    }

    this.addColorControl(section, "Accent color", profile.variables.accentColor,
      (value) => this.updateProfile({ variables: { accentColor: value } }, context));
    this.addColorControl(section, "Surface color", profile.variables.surfaceColor,
      (value) => this.updateProfile({ variables: { surfaceColor: value } }, context));
    this.addColorControl(section, "Text color", profile.variables.textColor,
      (value) => this.updateProfile({ variables: { textColor: value } }, context));
    new Setting(section)
      .setName("Tab bar background opacity")
      .setDesc("Affects the tab header container background only; labels and icons stay fully opaque.")
      .addSlider((slider) => slider
        .setLimits(0, 100, 1)
        .setValue(profile.variables.tabBarOpacity)
        .setDynamicTooltip()
        .onChange((value) => this.updateProfile({ variables: { tabBarOpacity: value } }, context)));
    new Setting(section)
      .setName("Tab bar backdrop blur")
      .setDesc("Uses backdrop-filter where supported. Blur shows through translucent backgrounds; zero disables it.")
      .addSlider((slider) => slider
        .setLimits(0, 24, 1)
        .setValue(profile.variables.tabBarBlur)
        .setDynamicTooltip()
        .onChange((value) => this.updateProfile({ variables: { tabBarBlur: value } }, context)));
    this.addColorControl(section, "Tab bar gradient color", profile.variables.tabBarGradientColor,
      (value) => this.updateProfile({ variables: { tabBarGradientColor: value } }, context));
    new Setting(section)
      .setName("Tab bar gradient type")
      .setDesc("Choose linear, elliptical radial, or circular radial gradient.")
      .addDropdown((dropdown) => {
        dropdown.addOption("linear", "Linear");
        dropdown.addOption("radial", "Radial");
        dropdown.addOption("circle", "Circular radial");
        dropdown.setValue(profile.variables.tabBarGradientType)
          .onChange((value) => this.updateProfile({ variables: { tabBarGradientType: value } }, context));
      });
    new Setting(section)
      .setName("Tab bar gradient direction")
      .setDesc("Direction is used by linear gradients.")
      .addDropdown((dropdown) => {
        for (const direction of [
          "to right", "to left", "to bottom", "to top",
          "to bottom right", "to bottom left", "to top right", "to top left"
        ]) dropdown.addOption(direction, direction);
        dropdown.setValue(profile.variables.tabBarGradientDirection)
          .onChange((value) => this.updateProfile({
            variables: { tabBarGradientDirection: value }
          }, context));
      });
    new Setting(section)
      .setName("Tab bar radial gradient position")
      .setDesc("Position is used by radial and circular radial gradients.")
      .addDropdown((dropdown) => {
        for (const position of [
          "center", "top", "bottom", "left", "right",
          "top left", "top right", "bottom left", "bottom right"
        ]) dropdown.addOption(position, position);
        dropdown.setValue(profile.variables.tabBarGradientPosition)
          .onChange((value) => this.updateProfile({
            variables: { tabBarGradientPosition: value }
          }, context));
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
        }, context)));
    new Setting(section)
      .setName("Reset global appearance")
      .setDesc("Restores global colors and tab bar appearance to Minimal defaults.")
      .addButton((button) => button
        .setButtonText("Reset")
        .onClick(() => this.updateProfile({
          variables: this.plugin.profileManager.builtInProfiles[0].variables,
          replaceVariables: true
        }, context, true)));

    const advanced = section.createEl("details", { cls: "cs-subsection" });
    advanced.createEl("summary", { text: "Advanced global CSS" });
    advanced.createEl("p", { text: "Advanced rules can affect any matching Obsidian interface element." });
    new Setting(advanced)
      .setName("Profile CSS")
      .addTextArea((text) => {
        text.setPlaceholder("Optional profile-wide CSS").setValue(profile.customCss);
        text.inputEl.addClass("cs-code-input");
        text.inputEl.addEventListener("blur", () => this.updateProfile({
          customCss: text.getValue()
        }, context));
      });
  }

  displayModules(containerEl, context) {
    const profile = this.plugin.profileManager.getActiveProfile();
    const section = containerEl.createEl("div", { cls: "cs-section cs-integrations" });
    section.createEl("h3", { text: "Integrations" });
    if (!this.isCustom(profile)) {
      section.createEl("p", { text: "Duplicate the active built-in profile to configure modules." });
      return;
    }

    if (!MODULES.some((module) => module.id === context.moduleId)) context.moduleId = MODULES[0].id;
    const integrationTabs = section.createEl("div", {
      cls: "cs-integration-tabs",
      attr: { role: "tablist", "aria-label": "Integrations" }
    });
    const activeModule = MODULES.find((module) => module.id === context.moduleId);
    const modulePanel = section.createEl("section", {
      cls: "cs-integration-panel",
      attr: {
        role: "tabpanel",
        tabindex: "0",
        id: `cs-${context.viewKey}-integration-panel`,
        "aria-label": `${activeModule.name} settings`
      }
    });
    modulePanel.setAttribute("aria-labelledby", `cs-${context.viewKey}-integration-${activeModule.id}`);
    const tabElements = [];
    for (const [index, module] of MODULES.entries()) {
      const tab = integrationTabs.createEl("button", {
        text: module.name,
        attr: {
          type: "button",
          role: "tab",
          "aria-selected": String(module.id === context.moduleId),
          tabindex: module.id === context.moduleId ? "0" : "-1",
          "aria-controls": `cs-${context.viewKey}-integration-panel`
        }
      });
      tabElements.push(tab);
      tab.setAttribute("id", `cs-${context.viewKey}-integration-${module.id}`);
      if (module.id === context.moduleId) tab.addClass("is-active");
      tab.addEventListener("click", () => {
        this.setViewState(context, { moduleId: module.id });
        this.refreshDisplay(context);
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0
          : event.key === "End" ? MODULES.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + MODULES.length) % MODULES.length;
        context.focusIntegrationTab = nextIndex;
        this.setViewState(context, { moduleId: MODULES[nextIndex].id });
        this.refreshDisplay(context);
      });
    }
    if (context.focusIntegrationTab !== undefined) {
      tabElements[context.focusIntegrationTab]?.focus();
      delete context.focusIntegrationTab;
    }
    this.displayModule(modulePanel, activeModule, profile, context);
  }

  displayModule(containerEl, module, profile, context) {
    const detected = this.plugin.moduleManager.isTargetPluginEnabled(module);
    const section = containerEl.createEl("div", { cls: "cs-module-section" });
    section.createEl("h4", { text: module.name });
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
          await this.persistChange(context);
          this.refreshProfilePreview(context);
        })));

    for (const group of module.controlGroups) {
      const groupEl = section.createEl("details", { cls: "cs-subsection", attr: { open: true } });
      groupEl.createEl("summary", { text: group.name });
      for (const control of group.controls) {
        this.displayControl(groupEl, module, profile, control, context);
      }
      if (module.id === "kanban" && group.name === "Columns") {
        this.displayColumnOverrides(groupEl, module, profile, context);
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
        }, context));
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
          await this.persistChange(context);
          this.refreshDisplay(context);
        })));
  }

  displayControl(containerEl, module, profile, control, context) {
    const value = profile.modules[module.id][control.key];
    const schema = module.settingsSchema[control.key];
    const setting = new Setting(containerEl).setName(control.name);
    if (control.desc) setting.setDesc(control.desc);
    else if (control.unit) setting.setDesc(`Current value: ${value}${control.unit}`);
    const update = (next) => this.updateModule(module.id, { [control.key]: next }, context);
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

  displayColumnOverrides(containerEl, module, profile, context) {
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
          }, context)))
        .addButton((button) => button
          .setButtonText("Clear")
          .onClick(() => {
            const next = { ...colors };
            delete next[name];
            this.updateModule(module.id, { columnColors: next }, context);
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

  updateProfile(update, context, refreshAfter = false) {
    return this.runChange(async () => {
      this.plugin.profileManager.updateActiveProfile(update);
      this.plugin.applyCustomization();
      this.refreshProfilePreview(context);
      if (refreshAfter) this.refreshDisplay(context);
      await this.persistChange(context, true);
    });
  }

  updateModule(moduleId, update, context) {
    return this.runChange(async () => {
      this.plugin.profileManager.updateModuleSettings(moduleId, update);
      this.plugin.applyCustomization();
      this.refreshProfilePreview(context);
      await this.persistChange(context, true);
    });
  }

  refreshProfilePreview(context) {
    if (!context?.preview) return;
    const profile = this.plugin.profileManager.getActiveProfile();
    context.preview.name.textContent = profile.name;
    const values = {
      Accent: profile.variables.accentColor,
      Surface: profile.variables.surfaceColor,
      Text: profile.variables.textColor,
      "Tab gradient": profile.variables.tabBarGradientColor
    };
    for (const swatch of context.preview.swatches) {
      const label = swatch.dataset.profileColor;
      const value = values[label];
      swatch.style.backgroundColor = value;
      swatch.setAttribute("title", `${label}: ${value}`);
      swatch.setAttribute("aria-label", `${label}: ${value}`);
    }
    const enabledModules = MODULES
      .filter((module) => profile.moduleEnabled[module.id] !== false)
      .map((module) => module.name);
    context.preview.moduleSummary.textContent = enabledModules.length
      ? `Enabled modules: ${enabledModules.join(", ")}`
      : "No modules enabled.";
    context.preview.name.parentElement?.setAttribute(
      "aria-label",
      `Active profile: ${profile.name}`
    );
  }

  async persistChange(context, alreadyApplied = false) {
    if (!alreadyApplied) this.plugin.applyCustomization();
    this.refreshOtherViews(context);
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
