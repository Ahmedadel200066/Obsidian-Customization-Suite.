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
    this.inputEl = { addClass() {}, addEventListener() {} };
  }

  empty() { this.children = []; }
  addClass() {}
  createEl(tag, options = {}) {
    const element = new FakeElement();
    element.tagName = tag;
    element.textContent = options.text || "";
    this.children.push(element);
    return element;
  }

  setAttribute(name, value) { this.attributes.set(name, value); }
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
  addOption() { return this; }
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
  let previewCount = 0;
  let saveCount = 0;
  const plugin = {
    profileManager: profiles,
    moduleManager: {
      isTargetPluginEnabled: () => false,
      getDetectedColumns: () => []
    },
    settingsManager: {
      scheduleSave: async () => { saveCount += 1; }
    },
    applyCustomization: () => { previewCount += 1; }
  };
  const tab = new CustomizationSettingTab({ containerEl: new FakeElement() }, plugin);
  tab.display();

  const labels = new Set(FakeSetting.records.map((setting) => setting.name));
  for (const label of [
    "Default column color",
    "Drag visual style",
    "Question and answer size",
    "Show answer button",
    "Row height",
    "Group spacing",
    "Tab bar opacity",
    "Tab bar gradient color",
    "Tab bar gradient direction",
    "Tab bar gradient intensity"
  ]) {
    assert.ok(labels.has(label), `Expected visual control "${label}" to render.`);
  }
  assert.equal(labels.has("Interface corner radius"), false);

  const columnColor = FakeSetting.actions.find((action) => action.name === "Default column color");
  await columnColor.run("#123456");
  assert.equal(profiles.getActiveProfile().modules.kanban.columnBackground, "#123456");
  assert.equal(previewCount, 1);
  assert.equal(saveCount, 1);

  const accentColor = FakeSetting.actions.find((action) => action.name === "Accent color");
  await accentColor.run("#abcdef");
  assert.equal(tab.profilePreview.swatches[0].style.backgroundColor, "#abcdef");

  profiles.updateActiveProfile({
    variables: { accentColor: "#123456", tabBarOpacity: 42, tabBarGradientIntensity: 30 }
  });
  tab.display();
  const reset = FakeSetting.actions.filter((action) => action.name === "Reset global appearance").at(-1);
  await reset.run();
  assert.deepEqual(
    profiles.getActiveProfile().variables,
    profiles.builtInProfiles[0].variables
  );
  assert.equal(tab.profilePreview.swatches[0].style.backgroundColor, "#7c6ce7");
  const resetAccent = FakeSetting.actions
    .filter((action) => action.name === "Accent color")
    .at(-1);
  assert.equal(resetAccent.component.value, "#7c6ce7");
  assert.equal(previewCount, 3);
  assert.equal(saveCount, 3);
});
