const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { MODULES } = require("./module-manager");
const { CARD_SHAPES } = require("../modules/bases/card-shapes");
const { shapeSchema, HOVER_EFFECTS } = require("../modules/bases/shape-options");

class CustomizationSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.importText = "";
    this.renameValue = "";
    this.viewContexts = new WeakMap();
    this.openViews = new Set();
    this.viewSaveTimers = new Set();
    this.pendingInputs=new Map();
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

    for (const observer of context.tabResizeObservers || []) observer.disconnect();
    context.tabResizeObservers = [];
    containerEl.empty();
    containerEl.addClass("customization-studio-settings");
    const header = containerEl.createEl("header", { cls: "cs-settings-header" });
    const customizationEnabled = this.plugin.settingsManager.settings.customizationEnabled !== false;
    const master = new Setting(header).setName("Customization")
      .setDesc("Pause all Customization Studio effects without losing your profiles.");
    master.settingEl?.addClass("cs-master-customization");
    master.controlEl?.createEl("span", {
      cls: "cs-customization-state", text: customizationEnabled ? "Enabled" : "Paused",
      attr: { role: "status", "aria-live": "polite" }
    });
    master.addToggle((toggle) => {
      const element = toggle.toggleEl || toggle.inputEl;
      element?.setAttribute?.("aria-label", "Customization Studio customization");
      toggle.setValue(customizationEnabled).onChange((enabled) => this.runChange(async () => {
        context.focusMasterToggle = true;
        await this.plugin.setCustomizationEnabled(enabled);
      }));
      if (context.focusMasterToggle) { element?.focus?.(); delete context.focusMasterToggle; }
    });
    header.createEl("p", {
      text: customizationEnabled
        ? "Visual profiles for Obsidian and supported plugins. Settings preview immediately and save automatically."
        : "Customization is paused. You can edit profiles; effects return when enabled."
    });
    new Setting(header).setName("What's new")
      .setDesc("See the release notes for this version.")
      .addButton((button) => button.setButtonText("Show what's new").onClick(() => this.plugin.showWhatsNew()));
    const activeProfile = this.plugin.profileManager.getActiveProfile();
    const profileHeader = header.createEl("div", {
      cls: "cs-active-profile-header",
      attr: { "aria-label": `Active profile: ${activeProfile.name}`, "aria-live": "polite" }
    });
    profileHeader.createEl("span", { cls: "cs-active-profile-badge", text: "Active profile" });
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
      text: enabledModules.length ? `${customizationEnabled ? "Enabled" : "Configured"}: ${enabledModules.join(", ")}` : "No modules enabled"
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
      ["global", "Global appearance"],
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
        context.focusPrimaryTab = tabs.findIndex(([tabId]) => tabId === id);
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
    this.decorateTabs(navigation, tabElements, context, "primary");
    if (context.focusPrimaryTab !== undefined) {
      tabElements[context.focusPrimaryTab]?.focus();
      delete context.focusPrimaryTab;
    }

    if (context.section === "global") {
      panel.setAttribute("aria-label", "Global appearance");
      this.displayGlobalSettings(panel, context);
    } else if (context.section === "profiles") {
      panel.setAttribute("aria-label", "Profiles");
      this.displayProfileSettings(panel, context);
    } else {
      panel.setAttribute("aria-label", "Integrations");
      this.displayModules(panel, context);
    }
    const footer = containerEl.createEl("footer", { cls: "cs-settings-footer" });
    footer.createEl("p", {
      text: "Support via plugin details."
    });
    containerEl.scrollTop = context.scrollTop;
  }

  decorateTabs(navigation, tabs, context, key) {
    const active = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    if (!active?.getBoundingClientRect) return;
    const doc = navigation.ownerDocument;
    const selected = active.id;
    const previous = context.tabIndicators?.[key];
    const indicator = navigation.createEl("span", {
      cls: "cs-tab-indicator",
      attr: { "aria-hidden": "true" }
    });
    navigation.addClass("cs-animated-tabs");
    const position = { left: active.offsetLeft, width: active.offsetWidth, selected };
    indicator.style.left = `${position.left}px`;
    indicator.style.width = `${position.width}px`;
    const reducedMotion = doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (previous && previous.selected !== selected && !reducedMotion) {
      indicator.animate?.([
        { left: `${previous.left}px`, width: `${previous.width}px` },
        { left: `${position.left}px`, width: `${position.width}px` }
      ], { duration: 220, easing: "ease-out" });
      const panel = key === "primary" ? context.panel : navigation.nextElementSibling;
      panel?.animate?.([
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 180, easing: "ease-out" });
    }
    context.tabIndicators ||= {};
    context.tabIndicators[key] = position;
    const end = position.left + position.width;
    const Observer = doc.defaultView?.ResizeObserver;
    if (Observer) {
      const observer = new Observer(() => {
        const next = { left: active.offsetLeft, width: active.offsetWidth, selected };
        indicator.style.left = `${next.left}px`;
        indicator.style.width = `${next.width}px`;
        context.tabIndicators[key] = next;
        if (next.left < navigation.scrollLeft) navigation.scrollLeft = next.left;
        else if (next.left + next.width > navigation.scrollLeft + navigation.clientWidth) {
          navigation.scrollLeft = next.left + next.width - navigation.clientWidth;
        }
      });
      observer.observe(navigation);
      observer.observe(active);
      (context.tabResizeObservers ||= []).push(observer);
    }
    if (position.left < navigation.scrollLeft) navigation.scrollLeft = position.left;
    else if (end > navigation.scrollLeft + navigation.clientWidth) navigation.scrollLeft = end - navigation.clientWidth;
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
    for (const observer of context.tabResizeObservers || []) observer.disconnect();
    this.viewContexts.delete(containerEl);
    this.openViews.delete(context);
  }

  queueLiveInput(element,change) {
    const previous=this.pendingInputs.get(element);if(previous)clearTimeout(previous.timer);
    const entry={change,timer:setTimeout(()=>this.flushLiveInput(element),180)};this.pendingInputs.set(element,entry);
  }

  flushLiveInput(element) {
    const entry=this.pendingInputs.get(element);if(!entry)return;
    clearTimeout(entry.timer);this.pendingInputs.delete(element);return entry.change();
  }

  async flushLiveInputs() {await Promise.all([...this.pendingInputs.keys()].map(element=>this.flushLiveInput(element)));}

  dispose() {
    for(const entry of this.pendingInputs.values())clearTimeout(entry.timer);this.pendingInputs.clear();
    this.captureViewState();
    for (const context of this.openViews) {
      context.containerEl.removeEventListener("scroll", context.scrollHandler);
      for (const observer of context.tabResizeObservers || []) observer.disconnect();
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
    new Setting(section).setName("Profiles").setHeading();
    section.createEl("p", {
      text: isCustom ? "Editing your copy. Changes save automatically." : "Built-in preset. Use Manage profile > Duplicate to make an editable copy. Create from Default starts from your own template instead."
    });

    new Setting(section)
      .setName("Active profile")
      .setDesc(`Currently selected: ${active.name}. ${this.plugin.settingsManager.settings.customizationEnabled === false ? "Changes apply when customization is enabled." : "Switching applies the profile immediately."}`)
      .addDropdown((dropdown) => {
        for (const profile of this.plugin.profileManager.getProfiles()) {
          dropdown.addOption(profile.id, profile.name);
        }
        dropdown.setValue(active.id).onChange((id) => this.runChange(async () => {
          this.plugin.profileManager.setActiveProfile(id);
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
          new Notice(`Customization Studio: ${this.plugin.settingsManager.settings.customizationEnabled === false ? "selected" : "applied"} "${this.plugin.profileManager.getActiveProfile().name}".`);
        }));
      });

    if(this.plugin.presentation)new Setting(section).setName("Appearance").setDesc("Each profile has Light and Dark variants. Follow Obsidian uses the host/system theme; editing changes the current variant.")
      .addDropdown(dropdown=>{
        dropdown.addOption("auto","Follow Obsidian / system").addOption("light","Light").addOption("dark","Dark");
        dropdown.setValue(this.plugin.presentation.meta().mode).onChange(mode=>this.runChange(async()=>{
          this.plugin.presentation.setMode(mode);this.plugin.applyCustomization();this.refreshAllViews();await this.persistChange(context,true);
        }));
      });

    new Setting(section)
      .setName("Create profile")
      .setDesc("Start from your editable Default template, not an imposed preset. Rename the new profile later.")
      .addButton((button) => button
        .setButtonText(this.plugin.presentation?"Create from Default":"Create copy from current")
        .setCta()
        .onClick(() => this.runChange(async () => {
          this.plugin.profileManager.createFromDefault();
          this.renameValue = "";
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
        })));

    const manage = section.createEl("details", { cls: "cs-subsection" });
    manage.createEl("summary", { text: "Manage profile" });
    {
      new Setting(manage)
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

    }
    if(isCustom){
      new Setting(manage)
        .setName("Rename profile")
        .addText((text) => {
          text.inputEl.maxLength = 100;
          text.setPlaceholder(active.name)
            .setValue(this.renameValue || active.name)
            .onChange((value) => { this.renameValue = value; });
        })
        .addButton((button) => button
          .setButtonText("Rename")
          .onClick(() => this.runChange(async () => {
            this.plugin.profileManager.renameCustomProfile(active.id, this.renameValue || active.name);
            this.renameValue = "";
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
    }

    new Setting(manage)
      .setName("Export profile")
      .setDesc("Copy the active profile with both variants and per-shape settings. This format needs the new build.")
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
        })))
      .addButton(button=>button.setButtonText("Legacy JSON").onClick(()=>this.runChange(async()=>{
        if(!globalThis.navigator?.clipboard?.writeText)throw new Error("Clipboard access is unavailable.");
        await globalThis.navigator.clipboard.writeText(this.plugin.profileManager.exportProfile(active.id,true));
        new Notice("Copied the current look in legacy format. Shape settings and the other variant are not included.");
      })));

    new Setting(manage)
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

    if (isCustom&&active.id!==this.plugin.presentation?.state.defaultProfileId) {
      new Setting(manage)
        .setName("Delete profile")
        .setDesc("Switches to Default if this is the active profile.")
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
    if (!this.isCustom(profile)) {
      section.createEl("p", { text: "Duplicate the active built-in profile to edit its settings." });
      return;
    }

    if(profile.studio?.neutral)section.createEl("p",{text:"Native styling is inherited until you change a control. These colors are captured from the current theme; this is not a replacement for your theme or CSS snippets."});
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
      .setDesc("Returns global controls to the captured Default baseline without imposing a preset.")
      .addButton((button) => button
        .setButtonText("Reset")
        .onClick(() => this.plugin.presentation?this.runChange(async()=>{
          this.plugin.presentation.resetGlobal();this.plugin.applyCustomization();this.refreshAllViews();await this.persistChange(context,true);
        }):this.updateProfile({variables:this.plugin.profileManager.builtInProfiles[0].variables,replaceVariables:true},context,true)));

    const advanced = section.createEl("details", { cls: "cs-subsection" });
    advanced.createEl("summary", { text: "Advanced global CSS" });
    advanced.createEl("p", { text: "Advanced rules can affect any matching Obsidian interface element." });
    new Setting(advanced)
      .setName("Profile CSS")
      .addTextArea((text) => {
        text.setPlaceholder("Optional profile-wide CSS").setValue(profile.customCss);
        text.inputEl.addClass("cs-code-input");
        text.onChange(value=>this.updateProfile({customCss:value},context));
      });
  }

  displayModules(containerEl, context) {
    const profile = this.plugin.profileManager.getActiveProfile();
    const section = containerEl.createEl("div", { cls: "cs-section cs-integrations" });
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
        context.focusIntegrationTab = index;
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
    this.decorateTabs(integrationTabs, tabElements, context, "integration");
    if (context.focusIntegrationTab !== undefined) {
      tabElements[context.focusIntegrationTab]?.focus();
      delete context.focusIntegrationTab;
    }
    this.displayModule(modulePanel, activeModule, profile, context);
  }

  displayModule(containerEl, module, profile, context) {
    const detected = this.plugin.moduleManager.isTargetPluginEnabled(module);
    const section = containerEl.createEl("div", { cls: "cs-module-section" });
    new Setting(section).setName(module.name).setHeading();
    section.createEl("p", {
      text: detected
        ? "Target detected. Styling applies when a matching view is open."
        : module.target.type === "core"
          ? "Obsidian Core Plugin is not enabled or its API is unavailable."
          : "Community plugin is not enabled."
    });

    if(context){context.themeColorToggle=null;context.integrationEnabledToggle=null;}
    if(profile.studio?.neutral)section.createEl("p",{text:"Untouched controls inherit native styling. Changing a control enables this integration and overrides only that control, not a preset palette."});
    if (module.compatibilityNote) section.createEl("p", { cls: "cs-compatibility-note", text: module.compatibilityNote });

    new Setting(section)
      .setName("Enable customization")
      .setDesc("Turning this off removes this integration's effects. Changing a control enables it again; master pause still wins.")
      .addToggle((toggle) => { if(context)context.integrationEnabledToggle={id:module.id,toggle};return toggle
        .setValue(profile.moduleEnabled[module.id] !== false)
        .onChange((value) => this.runChange(async () => {
          this.plugin.profileManager.setModuleEnabled(module.id, value);
          await this.persistChange(context);
          this.refreshProfilePreview(context);
        }));});

    for (const group of module.controlGroups) {
      const groupEl = section.createEl("details", { cls: "cs-subsection", attr: { open: true } });
      groupEl.createEl("summary", { text: group.name });
      for (const control of group.controls) {
        this.displayControl(groupEl, module, profile, control, context);
        if(module.id==="bases"&&control.key==="cardsShape"){
          this.displayShapeOptions(groupEl,context);this.displayCardShapeTarget(groupEl,context);
        }
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
        const change=()=>this.updateModule(module.id,{customCss:text.getValue()},context);
        text.onChange(()=>this.queueLiveInput(text.inputEl,change));
        text.inputEl.addEventListener("blur",()=>this.flushLiveInput(text.inputEl));
      });

    new Setting(section)
      .setName("Reset module settings")
      .setDesc("Restores this module's visual settings to their defaults.")
      .addButton((button) => button
        .setButtonText("Reset")
        .setWarning()
        .onClick(() => this.runChange(async () => {
          if(this.plugin.presentation)this.plugin.presentation.resetModule(module.id);
          else this.plugin.profileManager.updateActiveProfile({modules:{[module.id]:module.defaultSettings}});
          await this.persistChange(context);
          this.refreshDisplay(context);
        })));
  }

  displayShapeOptions(containerEl,context) {
    if(!this.plugin.presentation)return;
    const shape=this.plugin.profileManager.getActiveProfile().modules.bases.cardsShape;
    const options=this.plugin.presentation.getShapeOptions(shape),details=containerEl.createEl("details",{cls:"cs-subsection",attr:{open:true}});
    details.createEl("summary",{text:`${CARD_SHAPES[shape]} settings`});
    for(const [key,definition]of Object.entries(shapeSchema(shape))){
      const setting=new Setting(details).setName(definition.name);
      const description=value=>[definition.desc,key==="hover"?"Artwork only. Motion is disabled for reduced motion and touch.":"",definition.unit?`Current value: ${value}${definition.unit}`:""].filter(Boolean).join(" ");
      setting.setDesc(description(options[key]));
      const update=value=>this.runChange(async()=>{
        this.plugin.presentation.setShapeOptions(shape,{[key]:value});setting.setDesc(description(value));
        this.plugin.applyCustomization();this.refreshProfilePreview(context);await this.persistChange(context,true);
      });
      if(definition.options)setting.addDropdown(dropdown=>{for(const value of definition.options)dropdown.addOption(value,HOVER_EFFECTS[value]||value);dropdown.setValue(options[key]).onChange(update);});
      else if(typeof definition.default==="boolean")setting.addToggle(toggle=>toggle.setValue(options[key]).onChange(update));
      else setting.addSlider(slider=>slider.setLimits(definition.min,definition.max,definition.step||1).setValue(options[key]).setDynamicTooltip().onChange(update));
    }
    new Setting(details).setName("Reset this shape").addButton(button=>button.setButtonText("Reset").onClick(()=>this.runChange(async()=>{
      this.plugin.presentation.resetShape(shape);this.plugin.applyCustomization();this.refreshAllViews();await this.persistChange(context,true);
    })));
  }

  displayCardShapeTarget(containerEl, context) {
    const controller = this.plugin.moduleManager.controllers?.get("bases");
    const views = controller?.getShapeViews?.() || [];
    new Setting(containerEl)
      .setName("Temporary shape target")
      .setDesc("Select one open cards pane. Other Bases panes stay unchanged. Selection is not saved: reselect after restart, profile changes, reopening, or a detected cards-layout replacement. This is pane-scoped preview, not a persistent saved-view rule.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "None (do not apply shapes)");
        for (const view of views) dropdown.addOption(view.id, view.name);
        dropdown.setValue(controller?.shapeTarget?.id || "").onChange((id) => this.runChange(async () => {
          controller?.selectShapeTarget(id);
          this.refreshOtherViews(context);
        }));
      })
      .addButton((button) => button.setButtonText("Refresh panes").onClick(() => {
        this.plugin.moduleManager.refreshWithNotice?.();
        this.refreshDisplay(context);
      }));
    containerEl.createEl("p", { cls: "cs-compatibility-note", text: "Shapes use Bases card-cover classes. Check your real vault, embeds and mobile before relying on them. Metadata stays outside the cover. No notes or cover images are changed." });
  }

  displayControl(containerEl, module, profile, control, context) {
    const value = profile.modules[module.id][control.key];
    const schema = module.settingsSchema[control.key];
    const setting = new Setting(containerEl).setName(control.name);
    if (control.desc) setting.setDesc(control.desc);
    else if (control.unit) setting.setDesc(`Current value: ${value}${control.unit}`);
    const update = async(next) => {
      if(control.unit)setting.setDesc(`Current value: ${next}${control.unit}`);
      await this.updateModule(module.id, { [control.key]: next }, context,module.id==="bases"&&control.key==="cardsShape");
    };
    if (control.type === "color") {
      setting.addColorPicker((picker) => picker.setValue(value).onChange(update));
    } else if (control.type === "boolean") {
      setting.addToggle((toggle) => {if(control.key==="useThemeColors"&&context)context.themeColorToggle={id:module.id,toggle};return toggle.setValue(value).onChange(update);});
    } else if (control.type === "range") {
      setting.addSlider((slider) => slider
        .setLimits(schema.min, schema.max, schema.step || 1)
        .setValue(value)
        .setDynamicTooltip()
        .onChange(update));
    } else if (control.type === "select") {
      setting.addDropdown((dropdown) => {
        for (const option of schema.options) dropdown.addOption(option, module.id === "bases" && control.key === "cardsShape" ? CARD_SHAPES[option] : option);
        dropdown.setValue(value).onChange(update);
      });
    } else if (control.type === "text") {
      setting.addText((text) => {
        text.setPlaceholder("Assets/cover.jpg or https://example.com/cover.jpg").setValue(value);
        text.inputEl.type = "text";
        const change=()=>update(text.getValue().trim());
        text.onChange(()=>this.queueLiveInput(text.inputEl,change));
        text.inputEl.addEventListener("blur",()=>this.flushLiveInput(text.inputEl));
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
      const currentColors = () => this.plugin.profileManager.getActiveProfile().modules[module.id].columnColors;
      new Setting(containerEl)
        .setName(name)
        .addColorPicker((picker) => picker
          .setValue(colors[name] || this.plugin.profileManager.getActiveProfile().variables.accentColor || "#7c6ce7")
          .onChange((value) => this.updateModule(module.id, {
            columnColors: { ...currentColors(), [name]: value }
          }, context)))
        .addButton((button) => button
          .setButtonText("Clear")
          .onClick(() => {
            const next = { ...currentColors() };
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

  updateModule(moduleId, update, context,refreshAfter=false) {
    return this.runChange(async () => {
      this.plugin.profileManager.updateModuleSettings(moduleId, update);
      this.plugin.applyCustomization();
      this.refreshProfilePreview(context);
      if(refreshAfter)this.refreshDisplay(context);
      await this.persistChange(context, true);
    });
  }

  refreshProfilePreview(context) {
    const selected=this.plugin.profileManager.getActiveProfile();
    if(context?.integrationEnabledToggle){const {id,toggle}=context.integrationEnabledToggle;toggle.setValue(selected.moduleEnabled[id]!==false);}
    if(context?.themeColorToggle){const {id,toggle}=context.themeColorToggle;toggle.setValue(selected.modules[id].useThemeColors);}
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
      ? `${this.plugin.settingsManager.settings.customizationEnabled === false ? "Configured" : "Enabled"} modules: ${enabledModules.join(", ")}`
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
