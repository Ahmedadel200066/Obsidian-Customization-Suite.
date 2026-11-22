require("./host-path-stub.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const { whatsNewAction, isNewerVersion, SUPPORT_URL, WHATS_NEW } = require("../core/whats-new");
const { SettingsManager } = require("../core/settings-manager");

test("support link equals the manifest funding URL and notes exist for the current version", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  assert.equal(SUPPORT_URL, manifest.fundingUrl);
  assert.ok(WHATS_NEW[manifest.version], "Add release notes for the manifest version.");
});

test("what's new decisions: fresh install, upgrade, same version, downgrade, opt-out, missing notes", () => {
  const base = { currentVersion: "1.3.0", entries: { "1.3.0": {} }, enabled: true };
  assert.equal(whatsNewAction({ ...base, freshInstall: true, lastSeenVersion: null }), "record");
  assert.equal(whatsNewAction({ ...base, freshInstall: false, lastSeenVersion: null }), "show");
  assert.equal(whatsNewAction({ ...base, freshInstall: false, lastSeenVersion: "1.2.0" }), "show");
  assert.equal(whatsNewAction({ ...base, freshInstall: false, lastSeenVersion: "1.3.0" }), "none");
  assert.equal(whatsNewAction({ ...base, freshInstall: false, lastSeenVersion: "1.4.0" }), "record");
  assert.equal(whatsNewAction({ ...base, freshInstall: false, lastSeenVersion: "1.2.0", enabled: false }), "record");
  assert.equal(whatsNewAction({ ...base, entries: {}, freshInstall: false, lastSeenVersion: "1.2.0" }), "record");
  assert.equal(isNewerVersion("1.10.0", "1.9.0"), true);
  assert.equal(isNewerVersion("1.2.0", "1.2.0"), false);
});

test("lastSeenVersion and showWhatsNew load, default, and reject invalid values", async () => {
  const load = async (data) => { const m = new SettingsManager({ loadData: async () => data }); await m.load(); return m; };
  const fresh = await load(null);
  assert.equal(fresh.freshInstall, true);
  assert.equal(fresh.settings.lastSeenVersion, null);
  assert.equal(fresh.settings.showWhatsNew, true);
  const old = await load({ activeProfileId: "minimal" });
  assert.equal(old.freshInstall, false);
  assert.equal(old.settings.lastSeenVersion, null);
  const saved = await load({ lastSeenVersion: "1.2.0", showWhatsNew: false });
  assert.equal(saved.settings.lastSeenVersion, "1.2.0");
  assert.equal(saved.settings.showWhatsNew, false);
  await assert.rejects(() => load({ lastSeenVersion: "<b>1</b>" }), /lastSeenVersion/);
  await assert.rejects(() => load({ showWhatsNew: "yes" }), /showWhatsNew/);
});

function pluginWith({ freshInstall, lastSeenVersion, version = "1.2.0", showWhatsNew = true }) {
  const originalLoad = Module._load;
  class Modal { constructor() { this.opened = 0; } setTitle() {} open() { this.opened++; Modal.opened++; } close() {} }
  Modal.opened = 0;
  Module._load = function (request, parent, isMain) {
    if (request === "obsidian") return { Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Notice: class {}, Modal };
    return originalLoad.call(this, request, parent, isMain);
  };
  for (const file of ["../src/main.js", "../core/whats-new-modal.js", "../core/settings-modal.js", "../core/settings-tab.js"]) delete require.cache[require.resolve(file)];
  let Plugin;
  try { Plugin = require("../src/main.js"); } finally { Module._load = originalLoad; }
  const plugin = new Plugin();
  let saves = 0;
  plugin.manifest = { version };
  plugin.app = {};
  plugin.settingsManager = { freshInstall, settings: { lastSeenVersion, showWhatsNew }, scheduleSave: async () => { saves++; } };
  return { plugin, Modal, saves: () => saves };
}

test("modal shows once after an update, records the version, and never on a fresh install", () => {
  const upgrade = pluginWith({ freshInstall: false, lastSeenVersion: "1.1.0" });
  upgrade.plugin.checkWhatsNew();
  assert.equal(upgrade.Modal.opened, 1);
  assert.equal(upgrade.plugin.settingsManager.settings.lastSeenVersion, "1.2.0");
  assert.equal(upgrade.saves(), 1);
  upgrade.plugin.checkWhatsNew();
  assert.equal(upgrade.Modal.opened, 1);
  const fresh = pluginWith({ freshInstall: true, lastSeenVersion: null });
  fresh.plugin.checkWhatsNew();
  assert.equal(fresh.Modal.opened, 0);
  assert.equal(fresh.plugin.settingsManager.settings.lastSeenVersion, "1.2.0");
  const optedOut = pluginWith({ freshInstall: false, lastSeenVersion: "1.1.0", showWhatsNew: false });
  optedOut.plugin.checkWhatsNew();
  assert.equal(optedOut.Modal.opened, 0);
  assert.equal(optedOut.plugin.settingsManager.settings.lastSeenVersion, "1.2.0");
  const manual = pluginWith({ freshInstall: false, lastSeenVersion: "1.2.0" });
  manual.plugin.showWhatsNew();
  assert.equal(manual.Modal.opened, 1);
});


test("1.4.0 upgrade shows the new entry once and preserves support", () => {
  const upgrade = pluginWith({ freshInstall: false, lastSeenVersion: "1.3.0", version: "1.4.0" });
  upgrade.plugin.checkWhatsNew();
  assert.equal(upgrade.Modal.opened, 1);
  assert.equal(upgrade.plugin.settingsManager.settings.lastSeenVersion, "1.4.0");
  upgrade.plugin.checkWhatsNew();
  assert.equal(upgrade.Modal.opened, 1);
  assert.match(WHATS_NEW["1.4.0"].summary, /settings layout/);
  assert.ok(WHATS_NEW["1.4.0"].highlights.some(line => /round/.test(line)));
  assert.equal(SUPPORT_URL, "https://buymeacoffee.com/medoadel20y");
});
