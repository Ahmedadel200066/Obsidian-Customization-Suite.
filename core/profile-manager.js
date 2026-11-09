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

function validateProfile(profile, knownModuleIds) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("A profile must be a JSON object.");
  }
  if (typeof profile.id !== "string" || !PROFILE_ID_PATTERN.test(profile.id)) {
    throw new Error("Profile id must contain lowercase letters, numbers, and hyphens.");
  }
  if (typeof profile.name !== "string" || profile.name.trim().length === 0) {
    throw new Error(`Profile "${profile.id}" must have a name.`);
  }
  if (typeof profile.description !== "string") {
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

  if (typeof profile.customCss !== "string") {
    throw new Error(`Profile "${profile.id}" customCss must be a string.`);
  }
  if (!profile.moduleCss || typeof profile.moduleCss !== "object" || Array.isArray(profile.moduleCss)) {
    throw new Error(`Profile "${profile.id}" moduleCss must be an object.`);
  }

  const moduleCss = {};
  for (const [moduleId, css] of Object.entries(profile.moduleCss)) {
    if (!knownModuleIds.has(moduleId)) {
      throw new Error(`Profile "${profile.id}" references unknown module "${moduleId}".`);
    }
    if (typeof css !== "string") {
      throw new Error(`Profile "${profile.id}" moduleCss.${moduleId} must be a string.`);
    }
    moduleCss[moduleId] = css;
  }

  return {
    id: profile.id,
    name: profile.name.trim(),
    description: profile.description,
    variables,
    customCss: profile.customCss,
    moduleCss
  };
}

class ProfileManager {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.knownModuleIds = new Set(MODULES.map((module) => module.id));
    this.builtInProfiles = BUILT_IN_PROFILES.map((profile) => validateProfile(profile, this.knownModuleIds));
    this.customProfiles = [];
  }

  importProfile(raw) {
    const imported = validateProfile(JSON.parse(raw), this.knownModuleIds);
    const uniqueId = this.getProfile(imported.id) ? `custom-${imported.id}` : imported.id;
    const profile = validateProfile({ ...imported, id: uniqueId }, this.knownModuleIds);
    this.customProfiles.push(profile);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    this.settingsManager.settings.activeProfileId = profile.id;
    return profile;
  }

  exportProfile(id) {
    const profile = this.getProfile(id);
    if (!profile) {
      throw new Error(`Unknown profile "${id}".`);
    }
    return JSON.stringify(profile, null, 2);
  }

  load() {
    this.customProfiles = this.settingsManager.settings.customProfiles.map((profile) =>
      validateProfile(profile, this.knownModuleIds)
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

  setActiveProfile(id) {
    if (!this.getProfile(id)) {
      throw new Error(`Unknown customization profile "${id}".`);
    }
    this.settingsManager.settings.activeProfileId = id;
  }

  createCustomProfile(name) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Enter a name for the custom profile.");
    }

    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const baseId = `custom-${slug || "profile"}`;
    let id = baseId;
    let suffix = 2;
    while (this.getProfile(id)) {
      id = `${baseId}-${suffix++}`;
    }
    const activeProfile = this.getActiveProfile();
    const profile = validateProfile({
      ...JSON.parse(JSON.stringify(activeProfile)),
      id,
      name: trimmedName
    }, this.knownModuleIds);
    this.customProfiles.push(profile);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    this.settingsManager.settings.activeProfileId = id;
    return profile;
  }

  updateActiveProfile(update) {
    const active = this.getActiveProfile();
    const index = this.customProfiles.findIndex((profile) => profile.id === active.id);
    if (index < 0) {
      throw new Error("Create a custom profile before editing a built-in profile.");
    }
    const updated = validateProfile({ ...active, ...update }, this.knownModuleIds);
    this.customProfiles[index] = updated;
    this.settingsManager.settings.customProfiles = this.customProfiles;
    return updated;
  }

  deleteCustomProfile(id) {
    const index = this.customProfiles.findIndex((profile) => profile.id === id);
    if (index < 0) {
      throw new Error(`Cannot delete built-in or unknown profile "${id}".`);
    }
    this.customProfiles.splice(index, 1);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    if (this.settingsManager.settings.activeProfileId === id) {
      this.settingsManager.settings.activeProfileId = this.builtInProfiles[0].id;
    }
  }
}

module.exports = { ProfileManager, validateProfile };
