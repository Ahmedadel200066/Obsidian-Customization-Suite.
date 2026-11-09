const DEFAULT_SETTINGS = {
  activeProfileId: "minimal",
  customProfiles: [],
  moduleEnabled: {}
};

class SettingsManager {
  constructor(plugin, debounceMs = 300) {
    this.plugin = plugin;
    this.settings = { ...DEFAULT_SETTINGS };
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
      this.settings = { ...DEFAULT_SETTINGS };
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
      moduleEnabled: { ...moduleEnabled }
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

module.exports = { DEFAULT_SETTINGS, SettingsManager };
