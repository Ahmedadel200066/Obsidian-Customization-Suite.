const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const { SettingsManager } = require("../core/settings-manager");
const { ProfileManager } = require("../core/profile-manager");

class FakeElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.classes = new Set();
    this.listeners = new Map();
    this.scrollTop = 0;
    this.inputEl = { addClass() {}, addEventListener() {} };
  }

  empty() { this.children = []; }
  addClass(name) { this.classes.add(name); }
  createEl(tag, options = {}) {
    const element = new FakeElement();
    element.tagName = tag;
    element.textContent = options.text || "";
    element.parentElement = this;
    if (options.cls) element.addClass(options.cls);
    for (const [name, value] of Object.entries(options.attr || {})) {
      element.setAttribute(name, value);
    }
    this.children.push(element);
    return element;
  }

  setAttribute(name, value) { this.attributes.set(name, value); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  dispatch(name, event = {}) { this.listeners.get(name)?.(event); }
  focus() { this.focused = true; }
}

class FakeComponent {
  constructor() {
    this.inputEl = { addClass() {}, addEventListener() {} };
  }

  setValue(value) { this.value = value; return this; }
  getValue() { return this.value; }
  setPlaceholder(value) { this.placeholder = value; return this; }
  setButtonText(value) { this.buttonText = value; return this; }
  setLimits(min, max, step) { this.limits = { min, max, step }; return this; }
  setDynamicTooltip() { return this; }
  setCta() { return this; }
  setWarning() { return this; }
  addOption(value, label) { (this.options ||= []).push([value, label]); return this; }
  onChange(callback) { this.change = callback; return this; }
  onClick(callback) { this.click = callback; return this; }
}

class FakeSetting {
  static records = [];
  static actions = [];

  constructor(container) {
    this.container = container;
    this.name = "";
    FakeSetting.records.push(this);
  }

  setName(value) { this.name = value; return this; }
  setDesc() { return this; }

  addControl(method, callback) {
    const component = new FakeComponent();
    callback(component);
    if (component.change) {
      FakeSetting.actions.push({
        name: this.name,
        component,
        run: (value) => component.change(value)
      });
    }
    if (component.click) {
      FakeSetting.actions.push({
        name: this.name,
        component,
        run: () => component.click()
      });
    }
    return this;
  }

  addDropdown(callback) { return this.addControl("dropdown", callback); }
  addText(callback) { return this.addControl("text", callback); }
  addTextArea(callback) { return this.addControl("textarea", callback); }
  addButton(callback) { return this.addControl("button", callback); }
  addColorPicker(callback) { return this.addControl("color", callback); }
  addSlider(callback) { return this.addControl("slider", callback); }
  addToggle(callback) { return this.addControl("toggle", callback); }
}

function findElements(element, predicate, matches = []) {
  if (predicate(element)) matches.push(element);
  for (const child of element.children) findElements(child, predicate, matches);
  return matches;
}

test("settings UI renders visual controls and previews/persists module edits", async () => {
  const originalLoad = Module._load;
  class FakePluginSettingTab {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = app.containerEl;
    }
  }
  Module._load = function loadWithObsidianStub(request, parent, isMain) {
    if (request === "obsidian") {
      return { PluginSettingTab: FakePluginSettingTab, Setting: FakeSetting, Notice: class {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let CustomizationSettingTab;
  try {
    ({ CustomizationSettingTab } = require("../core/settings-tab"));
  } finally {
    Module._load = originalLoad;
  }

  FakeSetting.records = [];
  FakeSetting.actions = [];
  const settings = new SettingsManager({
    loadData: async () => null,
    saveData: async () => {}
  });
  await settings.load();
  const profiles = new ProfileManager(settings);
  profiles.load();
  profiles.createCustomProfile("UI test");
  settings.settings.uiState.settingsTab.section = "global";
  let previewCount = 0;
  let saveCount = 0;
  const plugin = {
    profileManager: profiles,
    moduleManager: {
      isTargetPluginEnabled: () => false,
      getDetectedColumns: () => []
    },
    settingsManager: {
      settings: settings.settings,
      scheduleSave: async () => { saveCount += 1; }
    },
    applyCustomization: () => { previewCount += 1; }
  };
  const tab = new CustomizationSettingTab({ containerEl: new FakeElement() }, plugin);
  tab.display();

  const labels = new Set(FakeSetting.records.map((setting) => setting.name));
  for (const label of [
    "Tab bar background opacity",
    "Tab bar backdrop blur",
    "Tab bar gradient color",
    "Tab bar gradient type",
    "Tab bar gradient direction",
    "Tab bar radial gradient position",
    "Tab bar gradient intensity"
  ]) {
    assert.ok(labels.has(label), `Expected visual control "${label}" to render.`);
  }
  assert.equal(labels.has("Interface corner radius"), false);

  let context = tab.viewContexts.get(tab.containerEl);
  tab.setViewState(context, { section: "integrations" });
  tab.refreshDisplay(context);
  for (const label of ["Default column color", "Drag visual style"]) {
    assert.ok(FakeSetting.records.some((setting) => setting.name === label));
  }
  const columnColor = FakeSetting.actions.find((action) => action.name === "Default column color");
  await columnColor.run("#123456");
  assert.equal(profiles.getActiveProfile().modules.kanban.columnBackground, "#123456");
  assert.equal(previewCount, 1);
  assert.equal(saveCount, 1);

  tab.setViewState(context, { moduleId: "spaced-repetition" });
  tab.refreshDisplay(context);
  assert.ok(FakeSetting.records.some((setting) => setting.name === "Question and answer size"));
  tab.setViewState(context, { moduleId: "bases" });
  tab.refreshDisplay(context);
  assert.ok(FakeSetting.records.some((setting) => setting.name === "Row height"));
  assert.ok(FakeSetting.records.some((setting) => setting.name === "Group spacing"));

  tab.setViewState(context, { section: "global" });
  tab.refreshDisplay(context);
  const accentColor = FakeSetting.actions.find((action) => action.name === "Accent color");
  await accentColor.run("#abcdef");
  assert.equal(context.preview.swatches[0].style.backgroundColor, "#abcdef");

  profiles.updateActiveProfile({
    variables: { accentColor: "#123456", tabBarOpacity: 42, tabBarGradientIntensity: 30 }
  });
  tab.display();
  context = tab.viewContexts.get(tab.containerEl);
  const reset = FakeSetting.actions.filter((action) => action.name === "Reset global appearance").at(-1);
  await reset.run();
  assert.deepEqual(
    profiles.getActiveProfile().variables,
    profiles.builtInProfiles[0].variables
  );
  assert.equal(context.preview.swatches[0].style.backgroundColor, "#7c6ce7");
  const resetAccent = FakeSetting.actions
    .filter((action) => action.name === "Accent color")
    .at(-1);
  assert.equal(resetAccent.component.value, "#7c6ce7");
  for (const [name, expected] of [
    ["Tab bar background opacity", 100],
    ["Tab bar backdrop blur", 0],
    ["Tab bar gradient type", "linear"],
    ["Tab bar gradient direction", "to right"],
    ["Tab bar radial gradient position", "center"],
    ["Tab bar gradient intensity", 0]
  ]) {
    const action = FakeSetting.actions.filter((item) => item.name === name).at(-1);
    assert.equal(action.component.value, expected, `Reset should refresh ${name}.`);
  }
  assert.equal(previewCount, 3);
  assert.equal(saveCount, 3);

  const modalRoot = new FakeElement();
  tab.displayInto(modalRoot, "ribbonModal");
  let modalContext = tab.viewContexts.get(modalRoot);
  assert.notEqual(modalContext, context);
  assert.equal(modalContext.section, "profiles");
  assert.equal(modalContext.moduleId, "kanban");
  tab.setViewState(modalContext, {
    section: "integrations",
    moduleId: "spaced-repetition"
  });
  modalRoot.scrollTop = 73;
  modalRoot.dispatch("scroll");
  tab.releaseDisplayTarget(modalRoot);
  tab.displayInto(modalRoot, "ribbonModal");
  modalContext = tab.viewContexts.get(modalRoot);
  assert.equal(modalContext.section, "integrations");
  assert.equal(modalContext.moduleId, "spaced-repetition");
  assert.equal(modalRoot.scrollTop, 73);

  const integrationsTab = findElements(tab.containerEl, (el) =>
    el.attributes.get("role") === "tab" && el.textContent === "Integrations")[0];
  integrationsTab.dispatch("click");
  const basesTab = findElements(tab.containerEl, (el) =>
    el.attributes.get("role") === "tab" && el.textContent === "Obsidian Bases")[0];
  basesTab.dispatch("click");
  tab.containerEl.scrollTop = 245;
  tab.containerEl.dispatch("scroll");
  assert.deepEqual(settings.settings.uiState.settingsTab, {
    section: "integrations",
    moduleId: "bases",
    scrollTop: 245
  });
  tab.containerEl.scrollTop = 0;
  tab.display();
  context = tab.viewContexts.get(tab.containerEl);
  assert.equal(tab.containerEl.scrollTop, 245);
  tab.releaseDisplayTarget(tab.containerEl);
  tab.displayInto(tab.containerEl, "settingsTab");
  context = tab.viewContexts.get(tab.containerEl);
  assert.equal(context.section, "integrations");
  assert.equal(context.moduleId, "bases");
  assert.equal(tab.containerEl.scrollTop, 245);

  tab.setViewState(context, { section: "profiles" });
  tab.refreshDisplay(context);
  const activeProfileAction = FakeSetting.actions
    .filter((action) => action.name === "Active profile")
    .at(-1);
  await activeProfileAction.run("minimal");
  assert.equal(profiles.getActiveProfile().id, "minimal");
  assert.equal(context.preview.name.textContent, "Minimal");
  assert.equal(modalContext.preview.name.textContent, "Minimal");

  tab.releaseDisplayTarget(tab.containerEl);
  tab.releaseDisplayTarget(modalRoot);
  tab.dispose();
  tab.releaseDisplayTarget(tab.containerEl);
});
