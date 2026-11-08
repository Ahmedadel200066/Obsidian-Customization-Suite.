const assert = require("node:assert/strict");
const test = require("node:test");
const { SettingsManager } = require("../core/settings-manager");
const { ProfileManager } = require("../core/profile-manager");
const { ThemeEngine } = require("../core/theme-engine");
const { ModuleManager } = require("../core/module-manager");

test("loads built-in profiles and creates, updates, and deletes custom profiles", async () => {
  const persisted = [];
  const settingsManager = new SettingsManager({
    loadData: async () => null,
    saveData: async (data) => persisted.push(data)
  });
  await settingsManager.load();
  const profiles = new ProfileManager(settingsManager);
  profiles.load();

  assert.equal(profiles.getProfiles().length, 5);
  assert.equal(profiles.getActiveProfile().id, "minimal");

  const custom = profiles.createCustomProfile("My Reading Setup");
  profiles.updateActiveProfile({
    variables: { ...custom.variables, accentColor: "#123456" }
  });
  assert.equal(profiles.getActiveProfile().variables.accentColor, "#123456");
  assert.equal(settingsManager.settings.customProfiles.length, 1);

  await settingsManager.save();
  assert.equal(persisted[0].customProfiles[0].name, "My Reading Setup");
  profiles.deleteCustomProfile(custom.id);
  assert.equal(profiles.getActiveProfile().id, "minimal");
  assert.equal(settingsManager.settings.customProfiles.length, 0);
});

test("rejects malformed saved settings instead of silently resetting them", async () => {
  const settingsManager = new SettingsManager({
    loadData: async () => ({ moduleEnabled: { kanban: "yes" } })
  });
  await assert.rejects(() => settingsManager.load(), /must be a boolean/);
});

test("rejects unsafe or unsupported profile variable values", async () => {
  const settingsManager = new SettingsManager({ loadData: async () => null });
  await settingsManager.load();
  const profiles = new ProfileManager(settingsManager);
  profiles.load();
  profiles.createCustomProfile("Editable");

  assert.throws(() => profiles.updateActiveProfile({
    variables: { accentColor: "red; background-image: url(https://example.invalid)" }
  }), /invalid accentColor/);
});

test("applies profile variables through removable styles without inline state changes", () => {
  const styles = [];
  const bodyClasses = new Set();
  const body = {
    classList: {
      add: (value) => bodyClasses.add(value),
      remove: (value) => bodyClasses.delete(value)
    },
    dataset: {},
    ownerDocument: null
  };
  const document = {
    body,
    head: { appendChild: (style) => styles.push(style) },
    createElement: () => ({ dataset: {}, remove() { this.removed = true; } })
  };
  body.ownerDocument = document;
  const plugin = {
    app: {
      workspace: { containerEl: { ownerDocument: document } },
      vault: { adapter: { read: async () => "" }, configDir: ".obsidian" }
    },
    manifest: { id: "customization-studio" },
    register() {}
  };
  const engine = new ThemeEngine(plugin);
  engine.apply({
    id: "test-profile",
    variables: { accentColor: "#123456", borderRadius: "8px" },
    customCss: ""
  });

  assert.equal(bodyClasses.has("customization-studio-enabled"), true);
  assert.match(engine.styles.get("variables").textContent, /--interactive-accent: var\(--cs-accent-color\)/);
  assert.match(engine.styles.get("variables").textContent, /--radius-m: var\(--cs-border-radius\)/);
  assert.equal(body.style, undefined);

  engine.unload();
  assert.equal(bodyClasses.has("customization-studio-enabled"), false);
  assert.equal(body.dataset.customizationStudioProfile, undefined);
  assert.equal(styles.every((style) => style.removed), true);
});

test("injects module CSS only for enabled target plugins", () => {
  const styles = [];
  const body = { dataset: {} };
  const document = {
    body,
    head: { appendChild: (style) => styles.push(style) },
    createElement: () => ({ dataset: {}, remove() { this.removed = true; } })
  };
  const profile = {
    moduleCss: { kanban: ".kanban { color: red; }" }
  };
  const plugin = {
    app: {
      plugins: { enabledPlugins: new Set(["obsidian-kanban"]) },
      workspace: { containerEl: { ownerDocument: document } }
    },
    settingsManager: { settings: { moduleEnabled: {} } },
    profileManager: { getActiveProfile: () => profile },
    register() {}
  };
  const manager = new ModuleManager(plugin);
  manager.refresh();

  assert.equal(styles.length, 1);
  assert.equal(styles[0].textContent, profile.moduleCss.kanban);
  assert.equal(body.dataset.customizationStudioModules, "kanban");

  manager.setEnabled("kanban", false);
  manager.refresh();
  assert.equal(styles[0].removed, true);
  assert.equal(body.dataset.customizationStudioModules, "");
});
