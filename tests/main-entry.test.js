require("./host-path-stub.cjs");
const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

test("ribbon action opens the settings modal and registered cleanup closes it", () => {
  const originalLoad = Module._load;
  class Plugin {}
  class PluginSettingTab {}
  class Setting {}
  class Notice {}
  class Modal {
    constructor() {
      this.modalEl = { addClass() {} };
      this.contentEl = { addClass() {}, empty() {} };
    }

    setTitle() {}
    open() { this.onOpen(); }
    close() { this.onClose(); }
  }
  Module._load = function loadWithObsidianStub(request, parent, isMain) {
    if (request === "obsidian") return { Plugin, PluginSettingTab, Setting, Notice, Modal };
    return originalLoad.call(this, request, parent, isMain);
  };

  let CustomizationStudioPlugin;
  let CustomizationStudioModal;
  try {
    CustomizationStudioPlugin = require("../src/main.js");
    ({ CustomizationStudioModal } = require("../core/settings-modal"));
  } finally {
    Module._load = originalLoad;
  }

  const plugin = new CustomizationStudioPlugin();
  const cleanups = [];
  let modalOpened = 0;
  let modalClosed = 0;
  let ribbonAction;
  let removed = false;
  plugin.app = {
    workspace: {
      on() { throw new Error("No undocumented context-menu event should be registered."); }
    }
  };
  plugin.settingsTab = {
    displayInto(containerEl) { assert.equal(containerEl, plugin.settingsModal.contentEl); },
    releaseDisplayTarget(containerEl) { assert.equal(containerEl, plugin.settingsModal.contentEl); }
  };
  plugin.settingsModal = {
    contentEl: {},
    open() { modalOpened++; },
    close() { modalClosed++; }
  };
  plugin.moduleManager = {
    modules: [{ id: "kanban", name: "Kanban", rootSelector: ".kanban-plugin" }]
  };
  plugin.addRibbonIcon = (icon, title, callback) => {
    assert.equal(icon, "paintbrush");
    assert.match(title, /Customization Studio/);
    ribbonAction = callback;
    return { remove: () => { removed = true; } };
  };
  plugin.register = (callback) => cleanups.push(callback);
  plugin.notifyUser = (message) => { throw new Error(message);   };
  plugin.registerCustomizationEntryPoints();
  ribbonAction();
  assert.equal(modalOpened, 1);
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(modalClosed, 1);
  assert.equal(removed, true);

  const contentEl = { addClass() {}, empty() {} };
  const renders = [];
  const settingsTab = {
    displayInto(containerEl, viewKey) { renders.push(["render", containerEl, viewKey]); },
    releaseDisplayTarget(containerEl) { renders.push(["release", containerEl]); }
  };
  const modal = new CustomizationStudioModal({}, settingsTab);
  modal.contentEl = contentEl;
  modal.open();
  modal.close();
  assert.deepEqual(renders, [
    ["render", contentEl, "ribbonModal"],
    ["release", contentEl]
  ]);
});

test("master switch applies pause/resume without unloading plugin and persists state", async () => {
  const PluginClass=require("../src/main.js");const plugin=new PluginClass();
  let themeApplied=0,modulesApplied=0,themePaused=0,modulesPaused=0,saves=0,ui=0;
  plugin.settingsManager={settings:{customizationEnabled:true},scheduleSave:async()=>{saves++;}};
  plugin.profileManager={getActiveProfile:()=>({id:"test"})};
  plugin.themeEngine={apply(){themeApplied++;},pause(){themePaused++;}};
  plugin.moduleManager={refresh(){modulesApplied++;},pause(){modulesPaused++;}};
  plugin.settingsTab={refreshAllViews(){ui++;}};
  await plugin.setCustomizationEnabled(false);
  assert.equal(themePaused,1);assert.equal(modulesPaused,1);assert.equal(themeApplied,0);assert.equal(modulesApplied,0);
  plugin.applyCustomization();assert.equal(themeApplied,0);assert.equal(modulesApplied,0);
  await plugin.setCustomizationEnabled(true);assert.equal(themeApplied,1);assert.equal(modulesApplied,1);
  assert.equal(saves,2);assert.equal(ui,2);await assert.rejects(()=>plugin.setCustomizationEnabled("yes"),/boolean/);
});

test('a queued UI callback cannot revive styles after unload',()=>{
 const PluginClass=require('../src/main.js'),plugin=new PluginClass();plugin.unloading=true;
 plugin.themeEngine={apply(){throw Error('style revival');}};plugin.moduleManager={refresh(){throw Error('observer revival');}};
 assert.equal(plugin.applyCustomization(),undefined);
});
