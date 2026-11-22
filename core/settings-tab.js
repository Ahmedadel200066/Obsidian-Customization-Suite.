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
    context.overrideIndicators = [];
    context.preview = null;
    context.hasCompactToolbar = true;
    if (context.section === "profiles") context.section = "advanced";
    const active = this.plugin.profileManager.getActiveProfile();
    const header = containerEl.createEl("header", { cls: "cs-toolbar" });
    const profileControl = new Setting(header).setName("Profile").addDropdown(dropdown => {
      for (const profile of this.plugin.profileManager.getProfiles()) dropdown.addOption(profile.id, profile.name);
      (dropdown.selectEl || dropdown.inputEl)?.setAttribute?.("aria-label", "Active profile");
      if (context.focusToolbar === "profile") { (dropdown.selectEl || dropdown.inputEl)?.focus?.();delete context.focusToolbar; }
      dropdown.setValue(active.id).onChange(id => this.runChange(async () => {
        context.focusToolbar = "profile";this.plugin.profileManager.setActiveProfile(id);
        this.plugin.applyCustomization();this.refreshAllViews();await this.persistChange(context, true);
      }));
    });
    profileControl.settingEl?.addClass("cs-toolbar-profile");
    if (this.plugin.presentation) new Setting(header).setName("Mode").addDropdown(dropdown => {
      dropdown.addOption("auto", "Follow Obsidian").addOption("light", "Light").addOption("dark", "Dark");
      (dropdown.selectEl || dropdown.inputEl)?.setAttribute?.("aria-label", "Appearance mode");
      if (context.focusToolbar === "mode") { (dropdown.selectEl || dropdown.inputEl)?.focus?.();delete context.focusToolbar; }
      dropdown.setValue(this.plugin.presentation.meta().mode).onChange(mode => this.runChange(async () => {
        context.focusToolbar = "mode";this.plugin.presentation.setMode(mode);this.plugin.applyCustomization();this.refreshAllViews();await this.persistChange(context, true);
      }));
    });
    const enabled = this.plugin.settingsManager.settings.customizationEnabled !== false;
    const power = new Setting(header).setName("Customization").addToggle(toggle => {
      const element = toggle.toggleEl || toggle.inputEl;
      element?.setAttribute?.("aria-label", "Customization Studio customization");
      toggle.setValue(enabled).onChange(value => this.runChange(async () => {
        context.focusMasterToggle = true;await this.plugin.setCustomizationEnabled(value);
      }));
      if (context.focusMasterToggle) { element?.focus?.();delete context.focusMasterToggle; }
    });
    power.settingEl?.addClass("cs-toolbar-power");
    const manage = header.createEl("button", { text: "Manage profiles", cls: "cs-manage-profiles", attr: { type: "button" } });
    manage.addEventListener("click", () => { context.scrollTop = 0;this.setViewState(context, { section: "advanced" });this.refreshDisplay(context); });
    const search = header.createEl("input", { cls: "cs-page-search", attr: { type: "search", placeholder: "Search this page", "aria-label": "Search this page" } });
    search.value = context.searchQuery || "";
    search.addEventListener("input", () => { context.searchQuery = search.value;this.filterPage(context); });
    search.addEventListener("keydown", event => { if (event.key === "Escape") { search.value = "";context.searchQuery = "";this.filterPage(context); } });
    const status = containerEl.createEl("p", { cls: "cs-view-status", attr: { role: "status", "aria-live": "polite" }, text: enabled ? "Changes apply immediately and save automatically." : "Paused. Edits are saved; effects return when enabled." });
    const layout = containerEl.createEl("div", { cls: "cs-settings-layout" });
    const navigation = layout.createEl("div", { cls: "cs-sidebar", attr: { role: "tablist", "aria-label": "Customization Studio settings", "aria-orientation": "vertical" } });
    const panel = layout.createEl("section", { cls: "cs-primary-panel", attr: { role: "tabpanel", tabindex: "0", id: `cs-${context.viewKey}-panel`, "aria-labelledby": `cs-${context.viewKey}-tab-${context.section}` } });
    context.panel = panel;
    const tabs = [["global", "Appearance"], ["integrations", "Plugins"], ["advanced", "Advanced"]];
    const pageSelect = containerEl.createEl("select", { cls: "cs-mobile-page", attr: { "aria-label": "Settings page" } });
    for (const [id, label] of tabs) pageSelect.createEl("option", { text: label, attr: { value: id } });
    pageSelect.value = context.section;
    // The select remains outside the tablist and is used only by the narrow layout.
    if (layout.before) layout.before(pageSelect);
    pageSelect.addEventListener("change", () => { context.focusPageSelect = true;context.searchQuery = "";context.scrollTop = 0;this.setViewState(context, { section: pageSelect.value });this.refreshDisplay(context); });
    if (context.focusPageSelect) { pageSelect.focus();delete context.focusPageSelect; }

    const tabElements = [];
    for (const [index, [id, label]] of tabs.entries()) {
      const tab = navigation.createEl("button", { text: label, attr: { type: "button", role: "tab", "aria-selected": String(context.section === id), tabindex: context.section === id ? "0" : "-1", "aria-controls": `cs-${context.viewKey}-panel`, id: `cs-${context.viewKey}-tab-${id}` } });
      if (context.section === id) tab.addClass("is-active");
      const select = () => { context.focusPrimaryTab = index;context.searchQuery = "";context.scrollTop = 0;this.setViewState(context, { section: id });this.refreshDisplay(context); };
      tab.addEventListener("click", select);
      tab.addEventListener("keydown", event => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
        context.focusPrimaryTab = next;context.searchQuery = "";context.scrollTop = 0;this.setViewState(context, { section: tabs[next][0] });this.refreshDisplay(context);
      });
      tabElements.push(tab);
    }
    if (context.focusPrimaryTab !== undefined) { tabElements[context.focusPrimaryTab]?.focus();delete context.focusPrimaryTab; }
    if (context.section === "global") { panel.setAttribute("aria-label", "Appearance");this.displayGlobalSettings(panel, context); }
    else if (context.section === "integrations") { panel.setAttribute("aria-label", "Plugins");this.displayModules(panel, context); }
    else { panel.setAttribute("aria-label", "Advanced");this.displayAdvancedSettings(panel, context); }
    context.searchStatus = panel.createEl("p", { cls: "cs-search-status", attr: { role: "status", "aria-live": "polite" } });
    this.filterPage(context);
    this.animatePanel(context, `${context.section}:${context.moduleId}`);
    const footer = containerEl.createEl("footer", { cls: "cs-settings-footer" });
    footer.createEl("p", { text: "Support via plugin details." });
    containerEl.scrollTop = context.scrollTop;
  }

  reducedMotion(context) {
    return context?.containerEl?.ownerDocument?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }

  animatePanel(context,key) {
    if(context.lastPanelKey&&context.lastPanelKey!==key&&!this.reducedMotion(context)) {
      context.panel?.animate?.([{opacity:0.9,transform:"translateY(4px)"},{opacity:1,transform:"translateY(0)"}],{duration:160,easing:"ease-out"});
    }
    context.lastPanelKey=key;
  }

  createControlGroup(containerEl,title,context,key,defaultOpen=false) {
    const group=containerEl.createEl("details",{cls:"cs-subsection"});
    group.open=context?.groupStates?.[key]??defaultOpen;
    group.createEl("summary",{text:title});
    group.addEventListener("toggle",()=>{
      if(!context?.searchQuery){context.groupStates||={};context.groupStates[key]=group.open;}
      if(group.open&&!this.reducedMotion(context))for(const child of [...group.children].slice(1))child.animate?.([{opacity:0.85,transform:"translateY(2px)"},{opacity:1,transform:"translateY(0)"}],{duration:140,easing:"ease-out"});
    });
    return group;
  }

  decorateControl(setting,scope,key,component,context,initialProfile,onResetValue=()=>{}) {
    if(!this.plugin.presentation||!setting.settingEl||key==="cardsShape")return;
    setting.settingEl.dataset.csControlScope=scope;setting.settingEl.dataset.csControlKey=key;
    const info=setting.infoEl||setting.settingEl.querySelector?.(".setting-item-info");
    const badge=info?.createEl("span",{cls:"cs-control-state",attr:{"aria-live":"polite"}});
    const reset=setting.controlEl?.createEl("button",{text:"Reset",cls:"cs-control-reset",attr:{type:"button","aria-label":`Reset ${key} override`}});
    const refresh=(profile=this.plugin.profileManager.getActiveProfile())=>{
      const keys=scope==="global"?profile.studio?.globalKeys:profile.studio?.moduleKeys[scope];
      const modified=keys?.includes(key)===true;
      const inherited=profile.studio?.neutral&&(scope!=="global"||profile.studio.appearance==="auto");
      if(badge){badge.textContent=modified?"Modified":inherited?"Inherited":"Profile default";badge.dataset.state=modified?"modified":"inherited";badge.title=inherited&&!modified?"Native styling is active. The control shows the stored profile baseline, not a live theme readout.":"This value belongs to the current profile variant.";}
      if(reset){reset.disabled=!modified;reset.title=inherited?"Remove only this override and inherit native styling.":"Restore this control to the profile baseline.";}
    };
    reset?.addEventListener("click",()=>this.runChange(async()=>{
      const restored=this.plugin.presentation.resetControl(scope,key);
      const pending=this.pendingInputs.get(component?.inputEl);
      if(pending){clearTimeout(pending.timer);this.pendingInputs.delete(component.inputEl);}
      component?.setValue(restored);onResetValue(restored);
      (component?.colorPickerEl||component?.sliderEl||component?.selectEl||component?.toggleEl||component?.inputEl)?.focus?.();
      this.plugin.applyCustomization();this.refreshProfilePreview(context);
      await this.persistChange(context,true);
    }));
    (context.overrideIndicators||=[]).push(refresh);refresh(initialProfile);
  }

  filterPage(context) {
    const panel = context.panel;
    if (!panel?.querySelectorAll) return;
    const query = (context.searchQuery || "").trim().toLowerCase();
    let matches = 0;
    for (const row of panel.querySelectorAll(".setting-item")) {
      const visible = !query || row.textContent.toLowerCase().includes(query);
      row.hidden = !visible;if (visible) matches++;
    }
    for (const group of panel.querySelectorAll("details")) {
      if (query) {
        if (!group.dataset.csSearchOpen) group.dataset.csSearchOpen = group.open ? "open" : "closed";
        const visible = [...group.querySelectorAll(".setting-item")].some(row => !row.hidden);
        group.hidden = !visible;if (visible) group.open = true;
      } else {
        group.hidden = false;
        if (group.dataset.csSearchOpen) { group.open = group.dataset.csSearchOpen === "open";delete group.dataset.csSearchOpen; }
      }
    }
    if (context.searchStatus) context.searchStatus.textContent = query ? (matches ? `${matches} matching settings on this page.` : "No settings match on this page. Try another page or plugin.") : "";
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

    if (!context?.hasCompactToolbar) {
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

    }

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

    new Setting(section).setName("Appearance").setHeading();
    section.createEl("p",{cls:"cs-section-description",text:"Make it yours. Reset removes one override without changing your other settings."});
    const basics=this.createControlGroup(section,"Colors",context,"global:colors",true);
    const more=this.createControlGroup(section,"Tab bar details",context,"global:tabs");
    const controls=[
      {key:"accentColor",name:"Accent color",type:"color"},
      {key:"surfaceColor",name:"Surface color",type:"color"},
      {key:"textColor",name:"Text color",type:"color"},
      {key:"tabBarOpacity",name:"Tab bar background opacity",type:"range",min:0,max:100,desc:"Tab header background only. Labels and icons stay fully opaque."},
      {key:"tabBarBlur",name:"Tab bar backdrop blur",type:"range",min:0,max:24,desc:"Visible through a translucent tab bar. Zero disables blur."},
      {key:"tabBarGradientColor",name:"Tab bar gradient color",type:"color"},
      {key:"tabBarGradientType",name:"Tab bar gradient type",options:["linear","radial","circle"]},
      {key:"tabBarGradientDirection",name:"Tab bar gradient direction",options:["to right","to left","to bottom","to top","to bottom right","to bottom left","to top right","to top left"]},
      {key:"tabBarGradientPosition",name:"Tab bar radial gradient position",options:["center","top","bottom","left","right","top left","top right","bottom left","bottom right"]},
      {key:"tabBarGradientIntensity",name:"Tab bar gradient intensity",type:"range",min:0,max:100,desc:"Zero disables the gradient."}
    ];
    for(const control of controls){
      const setting=new Setting(control.key.startsWith("tabBar")?more:basics).setName(control.name);
      if(control.desc)setting.setDesc(control.desc);
      let component;const update=value=>this.updateProfile({variables:{[control.key]:value}},context);
      if(control.type==="color")setting.addColorPicker(picker=>{component=picker;picker.setValue(profile.variables[control.key]).onChange(update);});
      else if(control.type==="range")setting.addSlider(slider=>{component=slider;slider.setLimits(control.min,control.max,1).setValue(profile.variables[control.key]).setDynamicTooltip().onChange(update);});
      else setting.addDropdown(dropdown=>{component=dropdown;for(const option of control.options)dropdown.addOption(option,option);dropdown.setValue(profile.variables[control.key]).onChange(update);});
      this.decorateControl(setting,"global",control.key,component,context,profile);
    }
    new Setting(section)
      .setName("Reset global appearance")
      .setDesc("Returns global controls to the captured Default baseline without imposing a preset.")
      .addButton((button) => button
        .setButtonText("Reset")
        .onClick(() => this.plugin.presentation?this.runChange(async()=>{
          this.plugin.presentation.resetGlobal();this.plugin.applyCustomization();this.refreshAllViews();await this.persistChange(context,true);
        }):this.updateProfile({variables:this.plugin.profileManager.builtInProfiles[0].variables,replaceVariables:true},context,true)));

  }

  displayAdvancedSettings(containerEl, context) {
    this.displayProfileSettings(containerEl, context);
    const profile = this.plugin.profileManager.getActiveProfile();
    const section = containerEl.createEl("div", { cls: "cs-section" });
    new Setting(section).setName("What's new").setDesc("Release notes and optional development support.").addButton(button => button.setButtonText("Show what's new").onClick(() => this.plugin.showWhatsNew()));
    if (!this.isCustom(profile)) return;
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
    const sourceSelect = section.createEl("select", { cls: "cs-mobile-module", attr: { "aria-label": "Plugin settings" } });
    for (const module of MODULES) sourceSelect.createEl("option", { text: module.name, attr: { value: module.id } });
    sourceSelect.value = context.moduleId;
    sourceSelect.addEventListener("change", () => { context.focusModuleSelect = true;context.searchQuery = "";context.scrollTop = 0;this.setViewState(context, { moduleId: sourceSelect.value });this.refreshDisplay(context); });
    if (context.focusModuleSelect) { sourceSelect.focus();delete context.focusModuleSelect; }

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
        context.searchQuery = "";context.scrollTop = 0;this.setViewState(context, { moduleId: module.id });
        this.refreshDisplay(context);
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0
          : event.key === "End" ? MODULES.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + MODULES.length) % MODULES.length;
        context.focusIntegrationTab = nextIndex;
        context.searchQuery = "";context.scrollTop = 0;this.setViewState(context, { moduleId: MODULES[nextIndex].id });
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
        ? "Detected. Styling applies to open views."
        : module.target.type === "core"
          ? "Obsidian Core Plugin is not enabled or its API is unavailable."
          : "Community plugin is not enabled."
    });

    if(context){context.themeColorToggle=null;context.integrationEnabledToggle=null;}
    section.createEl("p", { cls: "cs-section-description", text: "Inherited controls keep native styling. Modify a control to override it." });
    if (module.compatibilityNote) section.createEl("p", { cls: "cs-compatibility-note", text: module.compatibilityNote });

    new Setting(section)
      .setName("Enable customization")
      .setDesc("Edits enable this integration automatically. Master pause still applies.")
      .addToggle((toggle) => { if(context)context.integrationEnabledToggle={id:module.id,toggle};return toggle
        .setValue(profile.moduleEnabled[module.id] !== false)
        .onChange((value) => this.runChange(async () => {
          this.plugin.profileManager.setModuleEnabled(module.id, value);
          await this.persistChange(context);
          this.refreshProfilePreview(context);
        }));});

    const selectedBasics={
      kanban:["columnBackground","cardBackground","cardRadius","cardSpacing"],
      "spaced-repetition":["cardBackground","contentColor","contentFontSize","cardRadius"],
      bases:["cardsShape","tableTextSize","tableRowHeight"]
    };
    const basicKeys=new Set(selectedBasics[module.id]||module.controlGroups[0]?.controls.slice(0,4).map(control=>control.key)||[]);
    const basics=this.createControlGroup(section,"Basics",context,`${module.id}:basics`,true);
    const more=this.createControlGroup(section,"More settings",context,`${module.id}:more`);
    for(const group of module.controlGroups) {
      for(const control of group.controls.filter(control=>basicKeys.has(control.key)))this.displayControl(basics,module,profile,control,context);
      const remaining=group.controls.filter(control=>!basicKeys.has(control.key));
      if(!remaining.length&&!(module.id==="kanban"&&group.name==="Columns"))continue;
      const groupEl=this.createControlGroup(more,group.name,context,`${module.id}:${group.name}`);
      for(const control of remaining)this.displayControl(groupEl,module,profile,control,context);
      if(module.id==="kanban"&&group.name==="Columns")this.displayColumnOverrides(groupEl,module,profile,context);
    }
    if(module.id==="bases"){this.displayShapeOptions(more,context);this.displayCardShapeTarget(more,context);}

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
    let component;
    const update = async(next) => {
      if(control.unit)setting.setDesc(`Current value: ${next}${control.unit}`);
      await this.updateModule(module.id, { [control.key]: next }, context,module.id==="bases"&&control.key==="cardsShape");
    };
    if (control.type === "color") {
      setting.addColorPicker((picker) => {component=picker;return picker.setValue(value).onChange(update);});
    } else if (control.type === "boolean") {
      setting.addToggle((toggle) => {component=toggle;if(control.key==="useThemeColors"&&context)context.themeColorToggle={id:module.id,toggle};return toggle.setValue(value).onChange(update);});
    } else if (control.type === "range") {
      setting.addSlider((slider) => {component=slider;return slider
        .setLimits(schema.min, schema.max, schema.step || 1)
        .setValue(value)
        .setDynamicTooltip()
        .onChange(update);});
    } else if (control.type === "select") {
      setting.addDropdown((dropdown) => {
        component=dropdown;
        for (const option of schema.options) dropdown.addOption(option, module.id === "bases" && control.key === "cardsShape" ? CARD_SHAPES[option] : option);
        dropdown.setValue(value).onChange(update);
      });
    } else if (control.type === "text") {
      setting.addText((text) => {
        component=text;
        text.setPlaceholder("Assets/cover.jpg or https://example.com/cover.jpg").setValue(value);
        text.inputEl.type = "text";
        const change=()=>update(text.getValue().trim());
        text.onChange(()=>this.queueLiveInput(text.inputEl,change));
        text.inputEl.addEventListener("blur",()=>this.flushLiveInput(text.inputEl));
      });
    }
    this.decorateControl(setting,module.id,control.key,component,context,profile,next=>{if(control.unit)setting.setDesc(`Current value: ${next}${control.unit}`);});
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
    for(const refresh of context?.overrideIndicators||[])refresh(selected);
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
