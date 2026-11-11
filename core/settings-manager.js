const DEFAULT_SETTINGS = {
  activeProfileId: "minimal",
  customProfiles: [],
  moduleEnabled: {},
  uiState: {
    settingsTab: { section: "profiles", moduleId: "kanban", scrollTop: 0 },
    ribbonModal: { section: "profiles", moduleId: "kanban", scrollTop: 0 }
  }
};
const UI_SECTIONS = new Set(["global", "profiles", "integrations"]);

function validateUiState(value) {
  if (value === undefined) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Customization Studio uiState setting must be an object.");
  }
  const result = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState));
  for (const key of ["settingsTab", "ribbonModal"]) {
    const saved = value[key];
    if (saved === undefined) continue;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      throw new Error(`Customization Studio uiState.${key} must be an object.`);
    }
    const section = saved.section ?? result[key].section;
    const moduleId = saved.moduleId ?? result[key].moduleId;
    const scrollTop = saved.scrollTop ?? result[key].scrollTop;
    if (!UI_SECTIONS.has(section) || typeof moduleId !== "string" ||
        !/^[a-z0-9-]{1,64}$/.test(moduleId) ||
        typeof scrollTop !== "number" || !Number.isFinite(scrollTop) ||
        scrollTop < 0 || scrollTop > 10000000) {
      throw new Error(`Customization Studio uiState.${key} contains invalid navigation state.`);
    }
    result[key] = { section, moduleId, scrollTop };
  }
  return result;
}

class SettingsManager {
  constructor(plugin, debounceMs = 300) {
    this.plugin = plugin;
    this.settings = {
      ...DEFAULT_SETTINGS,
      uiState: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState))
    };
    this.debounceMs = debounceMs;
    this.revision = 0;
    this.dirty = false;
    this.timer = null;
    this.flushPromise = null;
    this.saveQueue = Promise.resolve();
    this.waiters = [];
  }

  async load() {
    const data = await this.plugin.loadData();
    if (data == null) {
      this.settings = {
        ...DEFAULT_SETTINGS,
        uiState: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState))
      };
      return;
    }

    if (typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Customization Studio settings must be a JSON object.");
    }

    const customProfiles = data.customProfiles ?? [];
    const moduleEnabled = data.moduleEnabled ?? {};
    const activeProfileId = data.activeProfileId ?? DEFAULT_SETTINGS.activeProfileId;
    if (!Array.isArray(customProfiles)) {
      throw new Error("Customization Studio customProfiles setting must be an array.");
    }
    if (typeof moduleEnabled !== "object" || moduleEnabled === null || Array.isArray(moduleEnabled)) {
      throw new Error("Customization Studio moduleEnabled setting must be an object.");
    }
    if (typeof activeProfileId !== "string") {
      throw new Error("Customization Studio activeProfileId setting must be a string.");
    }
    for (const [moduleId, enabled] of Object.entries(moduleEnabled)) {
      if (typeof enabled !== "boolean") {
        throw new Error(`Customization Studio moduleEnabled.${moduleId} must be a boolean.`);
      }
    }

    this.settings = {
      ...DEFAULT_SETTINGS,
      activeProfileId,
      customProfiles,
      moduleEnabled: { ...moduleEnabled },
      uiState: validateUiState(data.uiState)
    };
  }

  scheduleSave(delay = this.debounceMs) {
    this.dirty = true;
    this.revision += 1;
    const promise = new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().then(
        () => this.settleWaiters(),
        (error) => this.settleWaiters(error)
      );
    }, delay);
    return promise;
  }

  async save() {
    return this.scheduleSave(0);
  }

  async flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.flushPromise) {
      await this.flushPromise;
      if (this.dirty) return this.flush();
      return;
    }
    if (!this.dirty) return;

    const snapshot = JSON.parse(JSON.stringify(this.settings));
    const savedRevision = this.revision;
    this.dirty = false;
    const pending = this.saveQueue
      .catch(() => undefined)
      .then(() => this.plugin.saveData(snapshot));
    this.saveQueue = pending;
    this.flushPromise = pending;
    try {
      await pending;
      if (this.revision !== savedRevision) this.dirty = true;
    } catch (error) {
      this.dirty = true;
      throw error;
    } finally {
      this.flushPromise = null;
    }
    if (this.dirty) return this.flush();
  }

  settleWaiters(error) {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
  }
}

module.exports = { DEFAULT_SETTINGS, SettingsManager, validateUiState };
