const assert = require("node:assert/strict");
const test = require("node:test");
const { SettingsManager } = require("../core/settings-manager");
const { ProfileManager } = require("../core/profile-manager");
const { ThemeEngine, tabBarGradient } = require("../core/theme-engine");
const { ModuleManager, MODULES } = require("../core/module-manager");
const { scopeCss } = require("../modules/css-scope");
const kanban = require("../modules/kanban");
const spacedRepetition = require("../modules/spaced-repetition");
const bases = require("../modules/bases");

class FakeElement {
  constructor(document, selectors = {}) {
    this.ownerDocument = document;
    this.selectors = selectors;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.classNames = new Set();
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.classList = {
      contains: (name) => this.classNames.has(name),
      add: (name) => this.classNames.add(name),
      remove: (name) => this.classNames.delete(name)
    };
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
    this.removed = true;
  }

  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(element) { return this === element || this.children.some((child) => child.contains?.(element)); }
  querySelector(selector) { return this.selectors[selector] || null; }
  querySelectorAll(selector) { return this.selectors[selector] || []; }
}

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; }
  observe(target) { this.target = target; }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback([]); }
}

function makeDocument() {
  const document = { defaultView: { MutationObserver: FakeMutationObserver } };
  document.createElement = () => new FakeElement(document);
  document.head = new FakeElement(document);
  document.body = new FakeElement(document);
  return document;
}

function makePlugin(data = null) {
  const stored = { value: data };
  const notices = [];
  const document = makeDocument();
  const plugin = {
    manifest: { id: "customization-studio" },
    app: {
      vault: {
        configDir: ".obsidian",
        adapter: { read: async (path) => { throw new Error(`Missing ${path}`); } }
      },
      workspace: {
        containerEl: new FakeElement(document),
        onLayoutReady(callback) { callback(); },
        on() { return { type: "event" }; }
      },
      plugins: { enabledPlugins: new Set() },
      internalPlugins: { getEnabledPluginById() { return null; } }
    },
    loadData: async () => stored.value,
    saveData: async (value) => { stored.value = JSON.parse(JSON.stringify(value)); },
    register() {},
    registerEvent() {},
    notifyUser: (message) => notices.push(message),
    notices,
    stored,
    document
  };
  plugin.app.workspace.containerEl.ownerDocument = document;
  return plugin;
}

async function loadProfileManager(plugin) {
  const settings = new SettingsManager(plugin);
  await settings.load();
  const profiles = new ProfileManager(settings);
  profiles.load();
  return { settings, profiles };
}

test("ships only the three V1 modules with independent settings contracts", () => {
  assert.deepEqual(MODULES.map((module) => module.id), ["kanban", "spaced-repetition", "bases"]);
  for (const module of MODULES) {
    assert.equal(typeof module.createController, "function");
    assert.equal(typeof module.validateSettings, "function");
    assert.ok(module.rootSelector);
    assert.ok(module.controlGroups.length > 0);
    assert.deepEqual(module.validateSettings(), module.defaultSettings);
  }
  assert.ok(kanban.defaultSettings.columnColors);
  assert.ok(spacedRepetition.defaultSettings.againColor);
  assert.ok(bases.defaultSettings.tableRowHeight);
});

test("profile data and module settings survive persistence and validate on reload", async () => {
  const plugin = makePlugin();
  const { settings, profiles } = await loadProfileManager(plugin);
  const custom = profiles.createCustomProfile("Study");
  profiles.updateModuleSettings("kanban", { cardRadius: 19, columnColors: { Done: "#123456" } });
  profiles.setModuleEnabled("bases", false);
  profiles.updateActiveProfile({
    variables: { accentColor: "#abcdef", tabBarOpacity: 64, tabBarGradientIntensity: 25 }
  });
  await settings.save();

  const restarted = await loadProfileManager(plugin);
  assert.equal(restarted.profiles.getActiveProfile().id, custom.id);
  assert.equal(restarted.profiles.getActiveProfile().modules.kanban.cardRadius, 19);
  assert.equal(restarted.profiles.getActiveProfile().modules.kanban.columnColors.Done, "#123456");
  assert.equal(restarted.profiles.getActiveProfile().moduleEnabled.bases, false);
  assert.equal(restarted.profiles.getActiveProfile().variables.accentColor, "#abcdef");
  assert.equal(restarted.profiles.getActiveProfile().variables.tabBarOpacity, 64);
  assert.equal(restarted.profiles.getActiveProfile().variables.tabBarGradientIntensity, 25);
});

test("legacy global corner radius migrates away and tab bar settings validate", async () => {
  const plugin = makePlugin({
    activeProfileId: "legacy",
    customProfiles: [{
      id: "legacy",
      name: "Legacy",
      description: "",
      variables: {
        accentColor: "#123456",
        borderRadius: "18px",
        tabBarOpacity: 55,
        tabBarGradientColor: "#abcdef",
        tabBarGradientDirection: "to bottom right",
        tabBarGradientIntensity: 30
      },
      customCss: "",
      modules: {},
      moduleEnabled: {}
    }]
  });
  const { profiles } = await loadProfileManager(plugin);
  const variables = profiles.getActiveProfile().variables;
  assert.equal(Object.hasOwn(variables, "borderRadius"), false);
  assert.equal(variables.tabBarOpacity, 55);
  assert.equal(variables.tabBarGradientColor, "#abcdef");
  assert.equal(variables.tabBarGradientDirection, "to bottom right");
  assert.equal(variables.tabBarGradientIntensity, 30);
  assert.equal(variables.tabBarBlur, 0);
  assert.equal(variables.tabBarGradientType, "linear");
  assert.equal(variables.tabBarGradientPosition, "center");
});

test("UI navigation state persists per view without storing DOM references", async () => {
  const plugin = makePlugin({
    uiState: {
      settingsTab: { section: "integrations", moduleId: "bases", scrollTop: 245 },
      ribbonModal: { section: "global", moduleId: "kanban", scrollTop: 18 }
    }
  });
  const settings = new SettingsManager(plugin);
  await settings.load();
  await settings.save();
  const restarted = new SettingsManager(plugin);
  await restarted.load();
  assert.deepEqual(restarted.settings.uiState, {
    settingsTab: { section: "integrations", moduleId: "bases", scrollTop: 245 },
    ribbonModal: { section: "global", moduleId: "kanban", scrollTop: 18 }
  });

  const invalid = new SettingsManager(makePlugin({
    uiState: { settingsTab: { section: "broken", moduleId: "bases", scrollTop: 0 } }
  }));
  await assert.rejects(() => invalid.load(), /invalid navigation state/);
});

test("invalid active profile recovers to Minimal and can be persisted", async () => {
  const plugin = makePlugin({ activeProfileId: "deleted-profile", customProfiles: [] });
  const settings = new SettingsManager(plugin);
  await settings.load();
  const profiles = new ProfileManager(settings);
  assert.equal(profiles.load(), true);
  assert.equal(profiles.getActiveProfile().id, "minimal");
  assert.equal(settings.settings.activeProfileId, "minimal");
  await settings.save();
  const restarted = await loadProfileManager(plugin);
  assert.equal(restarted.profiles.getActiveProfile().id, "minimal");
});

test("debounces rapid writes into a single persistence operation", async () => {
  let writeCount = 0;
  const plugin = makePlugin();
  plugin.saveData = async (value) => {
    writeCount += 1;
    plugin.stored.value = JSON.parse(JSON.stringify(value));
  };
  const manager = new SettingsManager(plugin);
  manager.settings.activeProfileId = "minimal";
  const first = manager.scheduleSave(10);
  manager.settings.activeProfileId = "dark-academia";
  const second = manager.scheduleSave(10);
  await Promise.all([first, second]);
  assert.equal(writeCount, 1);
  assert.equal(plugin.stored.value.activeProfileId, "dark-academia");
});

test("migrates old module CSS and preserves settings for removed modules", async () => {
  const plugin = makePlugin({
    activeProfileId: "old-profile",
    moduleEnabled: { kanban: false, bookshelf: false },
    customProfiles: [{
      id: "old-profile",
      name: "Old profile",
      description: "",
      variables: {},
      customCss: "",
      moduleCss: {
        kanban: ".kanban-plugin { color: red; }",
        bookshelf: ".bookshelf { color: blue; }"
      }
    }]
  });
  const { profiles } = await loadProfileManager(plugin);
  const profile = profiles.getActiveProfile();
  assert.equal(profile.moduleEnabled.kanban, false);
  assert.equal(profile.modules.kanban.customCss, ".kanban-plugin { color: red; }");
  assert.equal(profile.inactiveModuleCss.bookshelf, ".bookshelf { color: blue; }");
});

test("repeated profile imports receive genuinely unique IDs", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  const json = JSON.stringify({
    id: "minimal",
    name: "Imported",
    description: "Test import",
    variables: { accentColor: "#123456" },
    customCss: "",
    modules: {},
    moduleEnabled: {}
  });

  const imported = [profiles.importProfile(json), profiles.importProfile(json), profiles.importProfile(json)];
  assert.deepEqual(imported.map((profile) => profile.id), ["minimal-2", "minimal-3", "minimal-4"]);
  assert.equal(new Set(profiles.getProfiles().map((profile) => profile.id)).size, profiles.getProfiles().length);
});

test("profile import rejects invalid module settings and scoped CSS escapes", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  assert.throws(() => profiles.importProfile(JSON.stringify({
    id: "invalid-blur",
    name: "Invalid blur",
    description: "",
    variables: { tabBarBlur: 25 },
    customCss: "",
    modules: {}
  })), /tabBarBlur must be an integer from 0 to 24/);
  assert.throws(() => profiles.importProfile(JSON.stringify({
    id: "invalid",
    name: "Invalid",
    description: "",
    variables: {},
    customCss: "",
    modules: { kanban: { cardRadius: 999 } }
  })), /between 0 and 32/);
  assert.equal(
    scopeCss(".item, .card:hover { color: red; }", ".kanban-plugin"),
    ":where(.kanban-plugin) .item, :where(.kanban-plugin) .card:hover { color: red; }"
  );
  assert.throws(() => scopeCss("@import url(https://example.com/a.css);", ".kanban-plugin"), /not allowed/);
});

test("missing core CSS warns but does not prevent plugin stylesheet setup", async () => {
  const plugin = makePlugin();
  const theme = new ThemeEngine(plugin);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await theme.loadCoreCss(), false);
  } finally {
    console.warn = originalWarn;
  }
  assert.match(plugin.notices[0], /optional settings stylesheet/);
});

test("theme cleanup restores body state and removes only owned styles", () => {
  const plugin = makePlugin();
  const { profiles } = (() => {
    const settings = new SettingsManager(plugin);
    settings.settings = { activeProfileId: "minimal", customProfiles: [], moduleEnabled: {} };
    const manager = new ProfileManager(settings);
    manager.load();
    return { profiles: manager };
  })();
  plugin.profileManager = profiles;
  const body = plugin.document.body;
  body.classList.add("customization-studio-enabled");
  body.dataset.customizationStudioProfile = "other-plugin-profile";
  const external = plugin.document.createElement("style");
  plugin.document.head.appendChild(external);

  const theme = new ThemeEngine(plugin);
  theme.apply(profiles.getActiveProfile());
  const owned = theme.styles.get("variables");
  theme.unload();
  assert.equal(body.classList.contains("customization-studio-enabled"), true);
  assert.equal(body.dataset.customizationStudioProfile, "other-plugin-profile");
  assert.equal(owned.parentNode, null);
  assert.ok(external.parentNode);
});

test("tab bar styles are scoped and reflect validated opacity and gradient settings", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Tab bar");
  profiles.updateActiveProfile({
    variables: {
      surfaceColor: "#112233",
      tabBarOpacity: 40,
      tabBarGradientColor: "#abcdef",
      tabBarGradientDirection: "to left",
      tabBarGradientIntensity: 60,
      tabBarGradientType: "linear",
      tabBarBlur: 9
    }
  });
  plugin.profileManager = profiles;
  const theme = new ThemeEngine(plugin);
  theme.apply(profiles.getActiveProfile());

  const stylesheet = theme.styles.get("variables").textContent;
  assert.match(stylesheet, /\.workspace-tab-header-container\s*\{/);
  assert.match(stylesheet, /background-color: rgba\(17, 34, 51, 0\.4\)/);
  assert.match(stylesheet, /linear-gradient\(to left, rgba\(171, 205, 239, 0\.6\), transparent\)/);
  assert.match(stylesheet, /backdrop-filter: blur\(9px\)/);
  assert.match(stylesheet, /-webkit-backdrop-filter: blur\(9px\)/);
  assert.doesNotMatch(stylesheet, /--cs-border-radius/);
});

test("transparent tab bar keeps text opaque and supports linear and radial gradients", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Transparency");
  plugin.profileManager = profiles;
  const theme = new ThemeEngine(plugin);

  for (const [opacity, alpha] of [[0, "0"], [50, "0.5"], [100, "1"]]) {
    profiles.updateActiveProfile({
      variables: { tabBarOpacity: opacity, tabBarGradientIntensity: 0, tabBarBlur: 0 }
    });
    theme.apply(profiles.getActiveProfile());
    const css = theme.styles.get("variables").textContent;
    if (opacity === 0) assert.match(css, /background-color: transparent/);
    else assert.match(css, new RegExp(`background-color: rgba\\(32, 32, 32, ${alpha}\\)`));
    assert.match(css, /background-image: none/);
    assert.doesNotMatch(css, /\.workspace-tab-header-container\s*\{[^}]*opacity:/s);
  }

  const radial = tabBarGradient({
    tabBarGradientType: "radial",
    tabBarGradientPosition: "top right",
    tabBarGradientColor: "#123456",
    tabBarGradientIntensity: 50
  });
  const circle = tabBarGradient({
    tabBarGradientType: "circle",
    tabBarGradientPosition: "bottom left",
    tabBarGradientColor: "#123456",
    tabBarGradientIntensity: 50
  });
  assert.equal(radial, "radial-gradient(ellipse at top right, rgba(18, 52, 86, 0.5), transparent)");
  assert.equal(circle, "radial-gradient(circle at bottom left, rgba(18, 52, 86, 0.5), transparent)");
  assert.equal(tabBarGradient({
    tabBarGradientType: "linear",
    tabBarGradientDirection: "to bottom",
    tabBarGradientColor: "#123456",
    tabBarGradientIntensity: 50
  }), "linear-gradient(to bottom, rgba(18, 52, 86, 0.5), transparent)");
});

test("target detection distinguishes community plugins and the Bases core plugin API", async () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  plugin.app.plugins.enabledPlugins.add("obsidian-kanban");
  assert.equal(manager.isTargetPluginEnabled(kanban), true);
  assert.equal(manager.isTargetPluginEnabled(spacedRepetition), false);
  assert.equal(manager.isTargetPluginEnabled(bases), false);

  plugin.app.internalPlugins.getEnabledPluginById = (id) => id === "bases" ? { enabled: true } : null;
  assert.equal(manager.isTargetPluginEnabled(bases), true);
});

test("Kanban styling updates detected columns and disable removes only its markers/styles", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Kanban test");
  plugin.profileManager = profiles;
  plugin.app.plugins.enabledPlugins.add("obsidian-kanban");
  const title = new FakeElement(plugin.document);
  title.textContent = "Done";
  const lane = new FakeElement(plugin.document, { [kanban.selectors.laneTitle]: title });
  const laneWrappers = [lane];
  const board = new FakeElement(plugin.document, { [kanban.selectors.laneWrapper]: laneWrappers });
  board.children.push(lane);
  lane.parentNode = board;
  plugin.app.workspace.containerEl.selectors[kanban.rootSelector] = [board];

  const manager = new ModuleManager(plugin);
  const controller = kanban.createController(plugin, manager, kanban);
  profiles.setModuleEnabled("kanban", true);
  controller.refresh(profiles.getActiveProfile());
  assert.deepEqual(controller.getColumnNames(), ["Done"]);
  assert.equal(lane.getAttribute("data-cs-kanban-column"), "c0");
  assert.match(controller.style.textContent, /\.kanban-plugin__drag-container/);
  assert.match(controller.style.textContent, /background-image: none/);

  const doingTitle = new FakeElement(plugin.document);
  doingTitle.textContent = "Doing";
  const doingLane = new FakeElement(plugin.document, { [kanban.selectors.laneTitle]: doingTitle });
  laneWrappers.push(doingLane);
  board.children.push(doingLane);
  doingLane.parentNode = board;
  controller.roots.get(board).trigger();
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.equal(doingLane.getAttribute("data-cs-kanban-column"), "c1");
  assert.deepEqual(controller.getColumnNames(), ["Doing", "Done"]);

  const injected = controller.style;
  profiles.setModuleEnabled("kanban", false);
  controller.refresh(profiles.getActiveProfile());
  assert.equal(lane.getAttribute("data-cs-kanban-column"), null);
  assert.equal(injected.parentNode, null);
});

test("Kanban assigns distinct stable tokens and colors to independent columns", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Kanban columns");
  profiles.updateModuleSettings("kanban", {
    automaticColumnColors: false,
    columnColors: { Done: "#112233", Doing: "#abcdef" }
  });
  plugin.profileManager = profiles;
  plugin.app.plugins.enabledPlugins.add("obsidian-kanban");

  const doneTitle = new FakeElement(plugin.document);
  doneTitle.textContent = "Done";
  const doingTitle = new FakeElement(plugin.document);
  doingTitle.textContent = "Doing";
  const done = new FakeElement(plugin.document, { [kanban.selectors.laneTitle]: doneTitle });
  const doing = new FakeElement(plugin.document, { [kanban.selectors.laneTitle]: doingTitle });
  const wrappers = [done, doing];
  const board = new FakeElement(plugin.document, { [kanban.selectors.laneWrapper]: wrappers });
  plugin.app.workspace.containerEl.selectors[kanban.rootSelector] = [board];

  const controller = kanban.createController(plugin, new ModuleManager(plugin), kanban);
  controller.refresh(profiles.getActiveProfile());
  const doneToken = done.getAttribute("data-cs-kanban-column");
  const doingToken = doing.getAttribute("data-cs-kanban-column");
  assert.notEqual(doneToken, doingToken);
  assert.match(controller.style.textContent,
    new RegExp(`data-cs-kanban-column="${doneToken}"[^}]*background-color: rgba\\(17, 34, 51, 1\\)`));
  assert.match(controller.style.textContent,
    new RegExp(`data-cs-kanban-column="${doingToken}"[^}]*background-color: rgba\\(171, 205, 239, 1\\)`));

  wrappers.reverse();
  controller.roots.get(board).trigger();
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.equal(done.getAttribute("data-cs-kanban-column"), doneToken);
  assert.equal(doing.getAttribute("data-cs-kanban-column"), doingToken);
  controller.unload();
});

test("Kanban resolves local vault backgrounds and reports missing image paths", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Kanban cover");
  profiles.updateModuleSettings("kanban", {
    backgroundImage: "Assets/board cover.webp",
    columnBlur: 12,
    columnOpacity: 70,
    hoverGlow: true,
    glowIntensity: 55,
    cardGlowColor: "#123456",
    cardGlowBlur: 22,
    cardGlowMode: "always",
    columnGlowEnabled: true,
    columnGlowColor: "#abcdef",
    columnGlowIntensity: 45,
    columnGlowBlur: 30,
    columnGlowMode: "always"
  });
  plugin.profileManager = profiles;
  plugin.app.plugins.enabledPlugins.add("obsidian-kanban");
  plugin.app.vault.getAbstractFileByPath = (path) => ({
    path,
    extension: "webp"
  });
  plugin.app.vault.getResourcePath = (file) => `app://vault/${encodeURIComponent(file.path)}`;
  const board = new FakeElement(plugin.document);
  plugin.app.workspace.containerEl.selectors[kanban.rootSelector] = [board];
  const controller = kanban.createController(plugin, new ModuleManager(plugin), kanban);
  controller.refresh(profiles.getActiveProfile());

  assert.match(controller.style.textContent, /url\("app:\/\/vault\/Assets%2Fboard%20cover\.webp"\)/);
  assert.match(controller.style.textContent, /backdrop-filter: blur\(12px\)/);
  assert.match(controller.style.textContent, /rgba\(18, 52, 86, 0\.55\)/);
  assert.match(controller.style.textContent, /rgba\(171, 205, 239, 0\.45\)/);
  controller.unload();

  plugin.app.vault.getAbstractFileByPath = () => null;
  plugin.app.workspace.containerEl.selectors[kanban.rootSelector] = [new FakeElement(plugin.document)];
  const missingController = kanban.createController(plugin, new ModuleManager(plugin), kanban);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    missingController.refresh(profiles.getActiveProfile());
    await Promise.resolve();
  } finally {
    console.warn = originalWarn;
  }
  assert.match(plugin.notices.at(-1), /was not found/);
  missingController.unload();
});

test("Kanban background accepts safe vault paths and HTTP URLs only", () => {
  assert.equal(kanban.validateSettings({ backgroundImage: "./Assets/board.webp" }).backgroundImage,
    "Assets/board.webp");
  assert.equal(kanban.validateSettings({ backgroundImage: "https://example.com/board.png" }).backgroundImage,
    "https://example.com/board.png");
  assert.throws(() => kanban.validateSettings({ backgroundImage: "../outside.png" }), /relative path inside the vault/);
  assert.throws(() => kanban.validateSettings({ backgroundImage: "file:///tmp/board.png" }), /HTTP or HTTPS/);
  assert.throws(() => kanban.validateSettings({ backgroundImage: "https://" }),
    /valid vault path or HTTP\(S\) URL/);
});

test("Spaced Repetition controls inject only verified review-view selectors", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Study");
  plugin.profileManager = profiles;
  plugin.app.plugins.enabledPlugins.add("obsidian-spaced-repetition");
  const view = new FakeElement(plugin.document);
  plugin.app.workspace.containerEl.selectors[spacedRepetition.rootSelector] = [view];
  const manager = new ModuleManager(plugin);
  const controller = spacedRepetition.createController(plugin, manager, spacedRepetition);
  profiles.updateModuleSettings("spaced-repetition", { goodColor: "#123456", buttonHeight: 60 });
  controller.refresh(profiles.getActiveProfile());

  assert.match(controller.style.textContent, /\.sr-card-container \.sr-good-button/);
  assert.match(controller.style.textContent, /background-color: var\(--cs-sr-good\) !important/);
  assert.match(controller.style.textContent, /min-height: 60px/);
  profiles.setModuleEnabled("spaced-repetition", false);
  controller.refresh(profiles.getActiveProfile());
  assert.equal(controller.style, null);
});

test("Spaced Repetition diagnostics report counts without logging card content", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Study diagnostics");
  profiles.updateModuleSettings("spaced-repetition", { diagnostics: true });
  plugin.profileManager = profiles;
  plugin.app.plugins.enabledPlugins.add("obsidian-spaced-repetition");
  const buttons = [new FakeElement(plugin.document), new FakeElement(plugin.document)];
  const view = new FakeElement(plugin.document, { [spacedRepetition.selectors.button]: buttons });
  view.matches = (selector) => selector === spacedRepetition.selectors.root;
  plugin.app.workspace.containerEl.selectors[spacedRepetition.rootSelector] = [view];
  const controller = spacedRepetition.createController(plugin, new ModuleManager(plugin), spacedRepetition);
  const originalInfo = console.info;
  let diagnostics;
  console.info = (message, detail) => { diagnostics = { message, detail }; };
  try {
    controller.refresh(profiles.getActiveProfile());
  } finally {
    console.info = originalInfo;
  }
  assert.match(diagnostics.message, /Spaced Repetition diagnostics/);
  assert.deepEqual(diagnostics.detail, {
    detected: true,
    enabled: true,
    reviewViewOpen: true,
    matchedRoots: 1,
    cards: 1,
    reviewControls: 2,
    stylesInjected: true
  });
  controller.unload();
});

test("Bases controls generate documented native CSS variables and clean up", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Bases");
  plugin.profileManager = profiles;
  plugin.app.internalPlugins.getPluginById = (id) => id === "bases" ? { enabled: true } : null;
  const view = new FakeElement(plugin.document);
  plugin.app.workspace.containerEl.selectors[bases.rootSelector] = [view];
  const manager = new ModuleManager(plugin);
  const controller = bases.createController(plugin, manager, bases);
  profiles.updateModuleSettings("bases", { tableRowHeight: 44, cardsScale: 1.2 });
  controller.refresh(profiles.getActiveProfile());

  assert.match(controller.style.textContent, /--bases-table-row-height: 44px/);
  assert.match(controller.style.textContent, /--bases-cards-scale: 1\.2/);
  assert.match(controller.style.textContent, /--bases-table-header-background/);
  profiles.setModuleEnabled("bases", false);
  controller.refresh(profiles.getActiveProfile());
  assert.equal(controller.style, null);
});

test("Bases diagnostics report matched views and native variables without view content", async () => {
  const plugin = makePlugin();
  const { profiles } = await loadProfileManager(plugin);
  profiles.createCustomProfile("Bases diagnostics");
  profiles.updateModuleSettings("bases", { diagnostics: true });
  plugin.profileManager = profiles;
  plugin.app.internalPlugins.getPluginById = (id) => id === "bases" ? { enabled: true } : null;
  plugin.app.workspace.containerEl.selectors[bases.rootSelector] = [new FakeElement(plugin.document)];
  const controller = bases.createController(plugin, new ModuleManager(plugin), bases);
  const originalInfo = console.info;
  let diagnostics;
  console.info = (message, detail) => { diagnostics = { message, detail }; };
  try {
    controller.refresh(profiles.getActiveProfile());
  } finally {
    console.info = originalInfo;
  }
  assert.match(diagnostics.message, /Bases diagnostics/);
  assert.equal(diagnostics.detail.detected, true);
  assert.equal(diagnostics.detail.enabled, true);
  assert.equal(diagnostics.detail.matchedViews, 1);
  assert.equal(diagnostics.detail.stylesInjected, true);
  assert.ok(diagnostics.detail.appliedVariables.includes("--bases-table-row-height"));
  assert.ok(diagnostics.detail.appliedVariables.includes("--bases-cards-scale"));
  controller.unload();
});

test("Bases module is disabled cleanly when its core plugin is not enabled", () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  const controller = bases.createController(plugin, manager, bases);
  const profile = {
    moduleEnabled: { bases: true },
    modules: { bases: bases.defaultSettings }
  };
  controller.refresh(profile);
  assert.equal(controller.style, null);
});
