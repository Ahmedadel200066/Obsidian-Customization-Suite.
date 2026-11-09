const MODULES = require("../modules");

const BUILT_IN_PROFILES = [
  require("../profiles/minimal.json"),
  require("../profiles/dark-academia.json"),
  require("../profiles/glassmorphism.json"),
  require("../profiles/colorful.json"),
  require("../profiles/focus-mode.json")
];

const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const RADIUS_PATTERN = /^(0|[1-9]\d{0,2})px$/;

function validateProfile(profile, knownModules, legacyModuleEnabled = {}) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("A profile must be a JSON object.");
  }
  if (typeof profile.id !== "string" || !PROFILE_ID_PATTERN.test(profile.id)) {
    throw new Error("Profile id must contain lowercase letters, numbers, and hyphens.");
  }
  const allowedFields = new Set([
    "id", "name", "description", "variables", "customCss", "moduleEnabled",
    "modules", "moduleCss", "inactiveModuleCss"
  ]);
  for (const key of Object.keys(profile)) {
    if (!allowedFields.has(key)) {
      throw new Error(`Profile "${profile.id}" contains unsupported field "${key}".`);
    }
  }
  if (typeof profile.name !== "string" || profile.name.trim().length === 0 || profile.name.length > 100) {
    throw new Error(`Profile "${profile.id}" must have a name.`);
  }
  if (typeof profile.description !== "string" || profile.description.length > 2000) {
    throw new Error(`Profile "${profile.id}" must have a description.`);
  }
  if (!profile.variables || typeof profile.variables !== "object" || Array.isArray(profile.variables)) {
    throw new Error(`Profile "${profile.id}" variables must be an object.`);
  }

  const variables = {};
  for (const [key, value] of Object.entries(profile.variables)) {
    if (key === "accentColor" || key === "surfaceColor" || key === "textColor") {
      if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
        throw new Error(`Profile "${profile.id}" has an invalid ${key}.`);
      }
      variables[key] = value;
    } else if (key === "borderRadius") {
      if (typeof value !== "string" || !RADIUS_PATTERN.test(value)) {
        throw new Error(`Profile "${profile.id}" has an invalid borderRadius.`);
      }
      variables[key] = value;
    } else {
      throw new Error(`Profile "${profile.id}" contains unsupported variable "${key}".`);
    }
  }

  if (typeof profile.customCss !== "string" || profile.customCss.length > 30000) {
    throw new Error(`Profile "${profile.id}" customCss must be text no longer than 30000 characters.`);
  }
  const moduleSettings = profile.modules ?? {};
  if (typeof moduleSettings !== "object" || moduleSettings === null || Array.isArray(moduleSettings)) {
    throw new Error(`Profile "${profile.id}" modules must be an object.`);
  }
  for (const moduleId of Object.keys(moduleSettings)) {
    if (!knownModules.has(moduleId)) {
      throw new Error(`Profile "${profile.id}" references unknown module "${moduleId}".`);
    }
  }

  const oldModuleCss = profile.moduleCss ?? {};
  if (typeof oldModuleCss !== "object" || oldModuleCss === null || Array.isArray(oldModuleCss)) {
    throw new Error(`Profile "${profile.id}" moduleCss must be an object.`);
  }
  const modules = {};
  const savedInactiveCss = profile.inactiveModuleCss ?? {};
  if (typeof savedInactiveCss !== "object" || Array.isArray(savedInactiveCss)) {
    throw new Error(`Profile "${profile.id}" inactiveModuleCss must be an object.`);
  }
  const inactiveModuleCss = { ...savedInactiveCss };
  for (const module of MODULES) {
    const saved = moduleSettings[module.id] ?? {};
    if (typeof saved !== "object" || saved === null || Array.isArray(saved)) {
      throw new Error(`Profile "${profile.id}" modules.${module.id} must be an object.`);
    }
    const migratedCss = oldModuleCss[module.id];
    if (migratedCss !== undefined && typeof migratedCss !== "string") {
      throw new Error(`Profile "${profile.id}" moduleCss.${module.id} must be a string.`);
    }
    modules[module.id] = module.validateSettings({
      ...saved,
      ...(saved.customCss === undefined && migratedCss !== undefined ? { customCss: migratedCss } : {})
    });
  }
  for (const [moduleId, css] of Object.entries(oldModuleCss)) {
    if (!knownModules.has(moduleId)) {
      if (typeof css !== "string") {
        throw new Error(`Profile "${profile.id}" moduleCss.${moduleId} must be a string.`);
      }
      inactiveModuleCss[moduleId] = css;
    }
  }

  for (const [moduleId, css] of Object.entries(inactiveModuleCss)) {
    if (typeof css !== "string" || css.length > 10000) {
      throw new Error(`Profile "${profile.id}" inactiveModuleCss.${moduleId} must be a string.`);
    }
  }
  const compatibleLegacyEnabled = Object.fromEntries(
    Object.entries(legacyModuleEnabled).filter(([moduleId]) => knownModules.has(moduleId))
  );
  const moduleEnabled = { ...compatibleLegacyEnabled, ...(profile.moduleEnabled || {}) };
  for (const [moduleId, enabled] of Object.entries(moduleEnabled)) {
    if (!knownModules.has(moduleId) || typeof enabled !== "boolean") {
      throw new Error(`Profile "${profile.id}" has an invalid moduleEnabled.${moduleId} value.`);
    }
  }
  for (const module of MODULES) {
    if (moduleEnabled[module.id] === undefined) moduleEnabled[module.id] = true;
  }

  return {
    id: profile.id,
    name: profile.name.trim(),
    description: profile.description,
    variables,
    customCss: profile.customCss,
    moduleEnabled,
    modules,
    inactiveModuleCss
  };
}

class ProfileManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.modules = MODULES;
    this.knownModules = new Set(MODULES.map((module) => module.id));
    const legacyEnabled = settingsManager.settings.moduleEnabled || {};
    this.builtInProfiles = BUILT_IN_PROFILES.map((profile) =>
      validateProfile(profile, this.knownModules, legacyEnabled)
    );
    this.customProfiles = [];
  }

  load() {
    this.customProfiles = this.settingsManager.settings.customProfiles.map((profile) =>
      validateProfile(profile, this.knownModules, this.settingsManager.settings.moduleEnabled)
    );
    const ids = new Set();
    for (const profile of [...this.builtInProfiles, ...this.customProfiles]) {
      if (ids.has(profile.id)) {
        throw new Error(`Duplicate profile id "${profile.id}" in Customization Studio settings.`);
      }
      ids.add(profile.id);
    }
    if (!this.getProfile(this.settingsManager.settings.activeProfileId)) {
      this.settingsManager.settings.activeProfileId = this.builtInProfiles[0].id;
    }
    this.settingsManager.settings.customProfiles = this.customProfiles;
  }

  getProfiles() {
    return [...this.builtInProfiles, ...this.customProfiles];
  }

  getProfile(id) {
    return this.getProfiles().find((profile) => profile.id === id);
  }

  getActiveProfile() {
    return this.getProfile(this.settingsManager.settings.activeProfileId);
  }

  makeUniqueId(requestedId) {
    const normalized = requestedId.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
    const baseId = PROFILE_ID_PATTERN.test(normalized) ? normalized : "custom-profile";
    let id = baseId;
    let suffix = 2;
    while (this.getProfile(id)) {
      const suffixText = `-${suffix++}`;
      id = `${baseId.slice(0, 64 - suffixText.length)}${suffixText}`;
    }
    return id;
  }

  importProfile(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Profile JSON is invalid: ${error.message}`);
    }
    const imported = validateProfile(parsed, this.knownModules);
    const id = this.makeUniqueId(imported.id);
    const profile = { ...imported, id };
    this.customProfiles.push(profile);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    this.settingsManager.settings.activeProfileId = profile.id;
    return profile;
  }

  exportProfile(id) {
    const profile = this.getProfile(id);
    if (!profile) throw new Error(`Unknown profile "${id}".`);
    return JSON.stringify(profile, null, 2);
  }

  createCustomProfile(name, sourceId = this.getActiveProfile().id) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Enter a name for the custom profile.");
    const source = this.getProfile(sourceId);
    if (!source) throw new Error(`Unknown profile "${sourceId}".`);
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const profile = validateProfile({
      ...JSON.parse(JSON.stringify(source)),
      id: this.makeUniqueId(`custom-${slug || "profile"}`),
      name: trimmedName
    }, this.knownModules);
    this.customProfiles.push(profile);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    this.settingsManager.settings.activeProfileId = profile.id;
    return profile;
  }

  duplicateProfile(id) {
    const source = this.getProfile(id);
    if (!source) throw new Error(`Unknown profile "${id}".`);
    return this.createCustomProfile(`${source.name} copy`, id);
  }

  renameCustomProfile(id, name) {
    const profile = this.customProfiles.find((item) => item.id === id);
    if (!profile) throw new Error(`Cannot rename built-in or unknown profile "${id}".`);
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Enter a profile name.");
    profile.name = trimmedName;
    this.settingsManager.settings.customProfiles = this.customProfiles;
    return profile;
  }

  setActiveProfile(id) {
    if (!this.getProfile(id)) throw new Error(`Unknown customization profile "${id}".`);
    this.settingsManager.settings.activeProfileId = id;
  }

  updateActiveProfile(update) {
    const active = this.getActiveProfile();
    const index = this.customProfiles.findIndex((profile) => profile.id === active.id);
    if (index < 0) throw new Error("Create a custom profile before editing a built-in profile.");
    const { replaceVariables, ...profileUpdate } = update;
    const moduleUpdates = update.modules || {};
    const modules = Object.fromEntries(this.modules.map((module) => [
      module.id,
      { ...active.modules[module.id], ...(moduleUpdates[module.id] || {}) }
    ]));
    const updated = validateProfile({
      ...active,
      ...profileUpdate,
      variables: replaceVariables
        ? update.variables
        : { ...active.variables, ...(update.variables || {}) },
      moduleEnabled: { ...active.moduleEnabled, ...(update.moduleEnabled || {}) },
      modules
    }, this.knownModules);
    this.customProfiles[index] = updated;
    this.settingsManager.settings.customProfiles = this.customProfiles;
    return updated;
  }

  updateModuleSettings(moduleId, update) {
    if (!this.knownModules.has(moduleId)) throw new Error(`Unknown customization module "${moduleId}".`);
    const active = this.getActiveProfile();
    return this.updateActiveProfile({
      modules: { [moduleId]: { ...active.modules[moduleId], ...update } }
    });
  }

  setModuleEnabled(moduleId, enabled) {
    if (!this.knownModules.has(moduleId) || typeof enabled !== "boolean") {
      throw new Error(`Invalid module enabled state for "${moduleId}".`);
    }
    return this.updateActiveProfile({ moduleEnabled: { [moduleId]: enabled } });
  }

  deleteCustomProfile(id) {
    const index = this.customProfiles.findIndex((profile) => profile.id === id);
    if (index < 0) throw new Error(`Cannot delete built-in or unknown profile "${id}".`);
    this.customProfiles.splice(index, 1);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    if (this.settingsManager.settings.activeProfileId === id) {
      this.settingsManager.settings.activeProfileId = this.builtInProfiles[0].id;
    }
  }
}

module.exports = { ProfileManager, validateProfile };
