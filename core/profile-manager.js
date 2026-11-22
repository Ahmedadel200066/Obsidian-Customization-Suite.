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
const PROFILE_VARIABLE_DEFAULTS = {
  accentColor: "#7c6ce7",
  surfaceColor: "#202020",
  textColor: "#dddddd",
  tabBarOpacity: 100,
  tabBarBlur: 0,
  tabBarGradientColor: "#7c6ce7",
  tabBarGradientType: "linear",
  tabBarGradientDirection: "to right",
  tabBarGradientPosition: "center",
  tabBarGradientIntensity: 0
};
const TAB_BAR_GRADIENT_TYPES = new Set(["linear", "radial", "circle"]);
const TAB_BAR_GRADIENT_POSITIONS = new Set([
  "center", "top", "bottom", "left", "right",
  "top left", "top right", "bottom left", "bottom right"
]);
const TAB_BAR_GRADIENT_DIRECTIONS = new Set([
  "to right", "to left", "to bottom", "to top",
  "to bottom right", "to bottom left", "to top right", "to top left"
]);

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

  const variables = { ...PROFILE_VARIABLE_DEFAULTS };
  for (const [key, value] of Object.entries(profile.variables)) {
    if (key === "accentColor" || key === "surfaceColor" || key === "textColor") {
      if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
        throw new Error(`Profile "${profile.id}" has an invalid ${key}.`);
      }
      variables[key] = value;
    } else if (key === "tabBarGradientColor") {
      if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
        throw new Error(`Profile "${profile.id}" has an invalid ${key}.`);
      }
      variables[key] = value;
    } else if (key === "tabBarOpacity" || key === "tabBarBlur" || key === "tabBarGradientIntensity") {
      const max = key === "tabBarBlur" ? 24 : 100;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
        throw new Error(`Profile "${profile.id}" ${key} must be an integer from 0 to ${max}.`);
      }
      variables[key] = value;
    } else if (key === "tabBarGradientType") {
      if (!TAB_BAR_GRADIENT_TYPES.has(value)) {
        throw new Error(`Profile "${profile.id}" has an unsupported ${key}.`);
      }
      variables[key] = value;
    } else if (key === "tabBarGradientDirection") {
      if (!TAB_BAR_GRADIENT_DIRECTIONS.has(value)) {
        throw new Error(`Profile "${profile.id}" has an unsupported ${key}.`);
      }
      variables[key] = value;
    } else if (key === "tabBarGradientPosition") {
      if (!TAB_BAR_GRADIENT_POSITIONS.has(value)) {
        throw new Error(`Profile "${profile.id}" has an unsupported ${key}.`);
      }
      variables[key] = value;
    } else if (key === "borderRadius") {
      continue;
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
    if (moduleEnabled[module.id] === undefined) moduleEnabled[module.id] = module.defaultEnabled !== false;
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
    let recoveredActiveProfile = false;
    if (!this.getProfile(this.settingsManager.settings.activeProfileId)) {
      this.settingsManager.settings.activeProfileId = this.builtInProfiles[0].id;
      recoveredActiveProfile = true;
    }
    this.settingsManager.settings.customProfiles = this.customProfiles;
    return recoveredActiveProfile;
  }

  getProfiles() {
    const result=[...this.builtInProfiles, ...this.customProfiles];
    const id=this.presentation?.state.defaultProfileId;
    return id?[...result.filter(p=>p.id===id),...result.filter(p=>p.id!==id)]:result;
  }

  getProfile(id) {
    return this.getProfiles().find((profile) => profile.id === id);
  }

  getActiveProfile() {
    return this.presentation?.resolveProfile(this.settingsManager.settings.activeProfileId) || this.getProfile(this.settingsManager.settings.activeProfileId);
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
    let appearance;
    if(parsed?.format==="customization-studio-profile"){
      if(parsed.version!==2||!this.presentation)throw new Error("This profile needs the new appearance-enabled build.");
      appearance=parsed.appearance;if(!appearance||typeof appearance!=="object"||Array.isArray(appearance))throw new Error("The imported profile is missing its appearance settings.");parsed=parsed.profile;
    }
    const imported = validateProfile(parsed, this.knownModules);
    if(appearance){
      for(const mode of ["light","dark"])for(const variant of [appearance.variants?.[mode],appearance.baseline?.[mode]]){
        if(!variant)throw new Error("Missing imported light/dark variant.");
        validateProfile({...imported,variables:variant.variables,modules:variant.modules},this.knownModules);
      }
      this.presentation.validateState({version:1,defaultProfileId:null,profiles:{[imported.id]:appearance}});
    }
    const id = this.makeUniqueId(imported.id);
    const profile = { ...imported, id };
    this.customProfiles.push(profile);
    if(this.presentation)this.presentation.state.profiles[id]=appearance?JSON.parse(JSON.stringify(appearance)):this.presentation.newMeta(profile,false);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    this.settingsManager.settings.activeProfileId = profile.id;
    return profile;
  }

  exportProfile(id,legacy=false) {
    const profile = this.getProfile(id);
    if (!profile) throw new Error(`Unknown profile "${id}".`);
    if(this.presentation){
      const current=this.presentation.resolveProfile(id),clean=this.presentation.legacyData({customProfiles:[current]}).customProfiles[0];
      return JSON.stringify(legacy?clean:{format:"customization-studio-profile",version:2,profile:clean,appearance:this.presentation.meta(id)},null,2);
    }
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
    this.presentation?.cloneProfile(sourceId,profile.id);
    this.settingsManager.settings.customProfiles = this.customProfiles;
    this.settingsManager.settings.activeProfileId = profile.id;
    return profile;
  }

  createFromDefault() {
    const id=this.presentation?.state.defaultProfileId;
    if(!id) return this.createCopyFromCurrent();
    const names=new Set(this.getProfiles().map(p=>p.name.toLowerCase()));let name="Default copy",n=2;
    while(names.has(name.toLowerCase()))name=`Default copy ${n++}`;
    return this.createCustomProfile(name,id);
  }

  createCopyFromCurrent() {
    const source = this.getActiveProfile();
    const base = source.name.replace(/ copy(?: [0-9]+)?$/i, "").slice(0, 88);
    const names = new Set(this.getProfiles().map(profile => profile.name.toLowerCase()));
    let name = `${base} copy`;
    let suffix = 2;
    while (names.has(name.toLowerCase())) name = `${base} copy ${suffix++}`;
    return this.createCustomProfile(name, source.id);
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
    if (trimmedName.length > 100) throw new Error("Profile name must be no longer than 100 characters.");
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
    this.presentation?.recordUpdate(update);
    this.customProfiles[index] = updated;
    this.settingsManager.settings.customProfiles = this.customProfiles;
    return updated;
  }

  updateModuleSettings(moduleId, update) {
    if (!this.knownModules.has(moduleId)) throw new Error(`Unknown customization module "${moduleId}".`);
    const module=this.modules.find(item=>item.id===moduleId),active=this.getActiveProfile();
    const followsTheme=active.modules[moduleId].useThemeColors===true&&!Object.hasOwn(update,"useThemeColors")&&Object.keys(update).some(key=>module.settingsSchema[key]?.type==="color");
    const result=this.updateActiveProfile({modules:{[moduleId]:followsTheme?{...update,useThemeColors:false}:update},...(this.presentation?{moduleEnabled:{[moduleId]:true}}:{})});
    if(followsTheme&&this.presentation){const {value}=this.presentation.variant(active.id);value.moduleKeys[moduleId]=value.moduleKeys[moduleId].filter(key=>key!=="useThemeColors");}
    return result;
  }

  setModuleEnabled(moduleId, enabled) {
    if (!this.knownModules.has(moduleId) || typeof enabled !== "boolean") {
      throw new Error(`Invalid module enabled state for "${moduleId}".`);
    }
    return this.updateActiveProfile({ moduleEnabled: { [moduleId]: enabled } });
  }

  deleteCustomProfile(id) {
    if(id===this.presentation?.state.defaultProfileId)throw new Error("Default is the editable template and cannot be deleted.");
    const index = this.customProfiles.findIndex((profile) => profile.id === id);
    if (index < 0) throw new Error(`Cannot delete built-in or unknown profile "${id}".`);
    this.customProfiles.splice(index, 1);
    if(this.presentation)delete this.presentation.state.profiles[id];
    this.settingsManager.settings.customProfiles = this.customProfiles;
    if (this.settingsManager.settings.activeProfileId === id) {
      this.settingsManager.settings.activeProfileId = this.presentation?.state.defaultProfileId || this.builtInProfiles[0].id;
    }
  }
}

module.exports = { ProfileManager, validateProfile, PROFILE_VARIABLE_DEFAULTS };
