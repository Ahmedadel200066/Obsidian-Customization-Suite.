const DEFAULT_SETTINGS = {
  activeProfileId: "minimal",
  customProfiles: [],
  moduleEnabled: {}
};

class SettingsManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveQueue = Promise.resolve();
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

  async save() {
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    const pending = this.saveQueue.catch(() => undefined).then(() => this.plugin.saveData(snapshot));
    this.saveQueue = pending;
    await pending;
  }
}

module.exports = { DEFAULT_SETTINGS, SettingsManager };
