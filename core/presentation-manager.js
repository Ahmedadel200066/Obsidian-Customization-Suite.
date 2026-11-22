const { validateShapeOptions } = require("../modules/bases/shape-options");
const MODES = ["auto", "light", "dark"];
const copy = value => JSON.parse(JSON.stringify(value));
const COLORS = {
  minimal: { light: ["#7657c9", "#faf9fc", "#292633"], dark: ["#9b8af5", "#202027", "#e5e3ed"] },
  "dark-academia": { light: ["#846031", "#f5efdf", "#3b3024"], dark: ["#b18a58", "#29231e", "#e6dac5"] },
  glassmorphism: { light: ["#346eae", "#f0f6fc", "#20354d"], dark: ["#77b4ec", "#17212d", "#e2eef8"] },
  colorful: { light: ["#b22f70", "#fff7fb", "#3d2637"], dark: ["#ed83b6", "#252331", "#f1e5ef"] },
  "focus-mode": { light: ["#496a59", "#f7f8f6", "#28332c"], dark: ["#a7b9a9", "#202620", "#e2e9e2"] }
};
function mix(a, b, amount) {
  return "#" + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,"0")).join("");
}
function palette(variables, mode) {
  const background=variables.surfaceColor, text=variables.textColor, accent=variables.accentColor;
  return { background, text, accent, secondary:mix(background,text,.055), secondaryAlt:mix(background,text,.09), border:mix(background,text,.19), muted:mix(text,background,.30), faint:mix(text,background,.47), hover:mix(background,text,.09), onAccent:mode==="light"?"#ffffff":"#17151e" };
}
function detectMode(body) {
  if (body?.classList?.contains("theme-light") || body?.classList?.contains("light")) return "light";
  if (body?.classList?.contains("theme-dark") || body?.classList?.contains("dark")) return "dark";
  return body?.ownerDocument?.defaultView?.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function asHex(value, fallback) {
  const text=String(value||"").trim();if(/^#[0-9a-f]{6}$/i.test(text))return text.toLowerCase();
  if(/^#[0-9a-f]{3}$/i.test(text))return "#"+[...text.slice(1)].map(c=>c+c).join("");
  const match=text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)/i);
  return match ? "#"+match.slice(1,4).map(v=>Math.max(0,Math.min(255,Math.round(Number(v)))).toString(16).padStart(2,"0")).join("") : fallback;
}
function themedModules(modules, variables, mode) {
  const result=copy(modules), p=palette(variables,mode);
  for(const values of Object.values(result)) for(const key of Object.keys(values)) {
    if(typeof values[key]!=="string" || !/^#[0-9a-f]{6}$/i.test(values[key]))continue;
    if(/border|divider/i.test(key))values[key]=p.border;
    else if(/(?:text|contentColor|headerColor|fieldText)/i.test(key))values[key]=p.text;
    else if(/background|overlay/i.test(key))values[key]=/container|overlay/i.test(key)?p.background:p.secondary;
  }
  return result;
}
class PresentationManager {
  constructor(plugin) { this.plugin=plugin;this.pm=plugin.profileManager;this.state={version:1,defaultProfileId:null,profiles:{}};this.pendingShapeTarget=false; }
  get path() { const config=this.plugin.app.vault.configDir.replace(/\/+$/,"");return `${(this.plugin.manifest.dir||`${config}/plugins/${this.plugin.manifest.id}`).replace(/\/+$/,"")}/studio-appearance.json`; }
  body(){return this.plugin.app.workspace.containerEl.ownerDocument.body;}
  hostMode(){return detectMode(this.body());}
  captureVariables() {
    const body=this.body(), mode=this.hostMode(), fallback=COLORS.minimal[mode];
    const style=body.ownerDocument.defaultView?.getComputedStyle?.(body)||globalThis.getComputedStyle?.(body);
    const get=name=>{
      const raw=style?.getPropertyValue(name);
      if(!raw)return raw;
      if(/^#|^rgba?\(/i.test(raw.trim()))return raw;
      const canvas=body.ownerDocument.createElement("canvas"),context=canvas.getContext?.("2d");
      if(context){context.fillStyle=raw;context.fillRect(0,0,1,1);const data=context.getImageData(0,0,1,1).data;return `rgb(${data[0]},${data[1]},${data[2]})`;}
      return raw;
    };
    return {...this.pm.builtInProfiles[0].variables,accentColor:asHex(get("--interactive-accent"),fallback[0]),surfaceColor:asHex(get("--background-primary"),fallback[1]),textColor:asHex(get("--text-normal"),fallback[2]),tabBarOpacity:0,tabBarBlur:0,tabBarGradientIntensity:0};
  }
  newMeta(base,neutral=false) {
    const variants={};
    for(const mode of ["light","dark"]) {
      const colors=COLORS[base.id]?.[mode]||COLORS.minimal[mode];
      const variables=neutral&&mode===this.hostMode()?copy(base.variables):{...base.variables,accentColor:COLORS[base.id]?colors[0]:base.variables.accentColor,surfaceColor:colors[1],textColor:colors[2]};
      // Preserve the old custom look in its dark variant; built-ins have deliberate paired palettes.
      if(!neutral&&!COLORS[base.id]&&mode==="dark")Object.assign(variables,base.variables);
      variants[mode]={variables,modules:neutral?copy(base.modules):themedModules(base.modules,variables,mode),globalKeys:[],moduleKeys:{}};
    }
    return {neutral,mode:"auto",variants,baseline:copy(variants),shapes:{selected:base.modules.bases?.cardsShape||"standard",options:{}}};
  }
  validateState(raw) {
    if(!raw||raw.version!==1||!raw.profiles||typeof raw.profiles!=="object"||Array.isArray(raw.profiles))throw new Error("Invalid appearance settings file. Restore its backup instead of overwriting it.");
    if(raw.defaultProfileId!==null&&typeof raw.defaultProfileId!=="string")throw new Error("Invalid Default profile identifier.");
    for(const [id,meta]of Object.entries(raw.profiles)) {
      if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)||!meta||typeof meta.neutral!=="boolean"||!MODES.includes(meta.mode))throw new Error("Invalid profile appearance record.");
      for(const mode of ["light","dark"]) {
        const v=meta.variants?.[mode];if(!v||!Array.isArray(v.globalKeys)||!v.moduleKeys||typeof v.moduleKeys!=="object")throw new Error("Invalid light/dark variant.");
        if(v.globalKeys.some(key=>!Object.hasOwn(this.pm.builtInProfiles[0].variables,key)))throw new Error("Unknown global appearance key.");
        for(const [moduleId,keys] of Object.entries(v.moduleKeys)) {
          const module=this.pm.modules.find(m=>m.id===moduleId);
          if(!module||!Array.isArray(keys)||keys.some(key=>!Object.hasOwn(module.settingsSchema,key)))throw new Error("Invalid integration override list.");
        }
        const base=this.pm.getProfile(id);
        if(base) { const {validateProfile}=require("./profile-manager");validateProfile({...base,variables:v.variables,modules:v.modules},this.pm.knownModules);const baseline=meta.baseline?.[mode];if(!baseline)throw new Error("Missing variant baseline.");validateProfile({...base,variables:baseline.variables,modules:baseline.modules},this.pm.knownModules); }
      }
      if(!meta.shapes||typeof meta.shapes.selected!=="string"||!meta.shapes.options||typeof meta.shapes.options!=="object"||Array.isArray(meta.shapes.options))throw new Error("Invalid shape settings.");
      validateShapeOptions(meta.shapes.selected);
      for(const [shape,options]of Object.entries(meta.shapes.options))validateShapeOptions(shape,options);
    }
    return raw;
  }
  async load() {
    const adapter=this.plugin.app.vault.adapter;
    this.persistedData=copy((await this.plugin.loadData())??null);
    if(await adapter.exists(this.path)){
      const raw=JSON.parse(await adapter.read(this.path));let recovery;
      if(raw.transaction){
        const current=JSON.stringify(this.persistedData),after=JSON.stringify(raw.transaction.after),before=JSON.stringify(raw.transaction.before);
        if(current!==after){
          if(current!==before)throw new Error("data.json and studio-appearance.json do not match. Restore a matching backup pair before loading this build.");
          const {SettingsManager}=require("./settings-manager");const temporary=new SettingsManager({loadData:async()=>raw.transaction.after});await temporary.load();
          const {ProfileManager}=require("./profile-manager");const check=new ProfileManager(temporary);check.load();
          this.plugin.settingsManager.settings=temporary.settings;this.pm.customProfiles=check.customProfiles;recovery=raw.transaction.after;
        }
      }
      this.state=this.validateState(raw);
      if(recovery){await this.plugin.saveData(recovery);this.persistedData=copy(recovery);this.plugin.notifyUser?.("Recovered the latest Customization Studio settings after an interrupted save.");}
    }
    let created=false;
    if(!this.state.defaultProfileId||!this.pm.getProfile(this.state.defaultProfileId)) {
      const variables=this.captureVariables();const base=this.pm.createCustomProfile("Default",this.pm.builtInProfiles[0].id);
      base.variables=variables;base.description="Your current appearance. Nothing is overridden until you change a setting.";
      for(const module of this.pm.modules)base.moduleEnabled[module.id]=false;
      this.state.defaultProfileId=base.id;this.state.profiles[base.id]=this.newMeta(base,true);
      this.plugin.settingsManager.settings.activeProfileId=base.id;created=true;
    }
    for(const base of this.pm.getProfiles())if(!Object.hasOwn(this.state.profiles,base.id))this.state.profiles[base.id]=this.newMeta(base,false);
    return created;
  }
  meta(id=this.plugin.settingsManager.settings.activeProfileId) {return Object.hasOwn(this.state.profiles,id)?this.state.profiles[id]:null;}
  variant(id,body=this.body()) {const meta=this.meta(id);const mode=meta.mode==="auto"?detectMode(body):meta.mode;return {meta,mode,value:meta.variants[mode]};}
  resolveProfile(id,body=this.body()) {
    const base=this.pm.getProfile(id);const entry=this.meta(id);if(!base||!entry)return base;
    const {meta,mode,value}=this.variant(id,body);const effective={...base,variables:copy(value.variables),modules:copy(value.modules)};
    effective.modules.bases.cardsShape=meta.shapes.selected;
    Object.defineProperty(effective,"studio",{enumerable:false,value:{neutral:meta.neutral,mode,appearance:meta.mode,globalKeys:value.globalKeys,moduleKeys:value.moduleKeys,palette:palette(effective.variables,mode)}});
    return effective;
  }
  refreshInheritedPalette() {
    const id=this.plugin.settingsManager.settings.activeProfileId,meta=this.meta(id);
    if(!meta?.neutral||meta.mode!=="auto")return;
    const {value}=this.variant(id),captured=this.captureVariables();
    for(const key of ["accentColor","surfaceColor","textColor"])if(!value.globalKeys.includes(key))value.variables[key]=captured[key];
  }
  recordUpdate(update) {
    const id=this.plugin.settingsManager.settings.activeProfileId,{value}=this.variant(id);
    if(update.variables) {Object.assign(value.variables,update.variables);value.globalKeys=[...new Set([...value.globalKeys,...Object.keys(update.variables)])];}
    for(const [moduleId,settings]of Object.entries(update.modules||{})) {
      Object.assign(value.modules[moduleId],settings);
      value.moduleKeys[moduleId]=[...new Set([...(value.moduleKeys[moduleId]||[]),...Object.keys(settings).filter(k=>k!=="cardsShape")])];
      if(moduleId==="bases"&&settings.cardsShape!==undefined){this.meta(id).shapes.selected=settings.cardsShape;this.pendingShapeTarget=true;}
    }
  }
  cloneProfile(sourceId,newId) {const source=this.meta(sourceId);this.state.profiles[newId]=source?copy(source):this.newMeta(this.pm.getProfile(newId),false);}
  setMode(mode) {if(!MODES.includes(mode))throw new Error("Choose Follow Obsidian, Light, or Dark.");this.meta().mode=mode;}
  getShapeOptions(shape=this.meta().shapes.selected) {return validateShapeOptions(shape,this.meta().shapes.options[shape]);}
  setShapeOptions(shape,update) {if(!this.pm.customProfiles.some(p=>p.id===this.plugin.settingsManager.settings.activeProfileId))throw new Error("Create an editable profile first.");this.meta().shapes.options[shape]=validateShapeOptions(shape,{...this.getShapeOptions(shape),...update});this.pendingShapeTarget=true;this.pm.getProfile(this.plugin.settingsManager.settings.activeProfileId).moduleEnabled.bases=true;}
  resetShape(shape) {this.meta().shapes.options[shape]=validateShapeOptions(shape);this.pendingShapeTarget=true;}
  resetGlobal() {const {meta,mode,value}=this.variant(this.plugin.settingsManager.settings.activeProfileId);value.variables=copy(meta.baseline?.[mode]?.variables||this.captureVariables());value.globalKeys=[];this.pm.getProfile(this.plugin.settingsManager.settings.activeProfileId).variables=copy(value.variables);}
  resetModule(moduleId) {const {meta,mode,value}=this.variant(this.plugin.settingsManager.settings.activeProfileId);value.modules[moduleId]=copy(meta.baseline?.[mode]?.modules?.[moduleId]||this.pm.modules.find(m=>m.id===moduleId).defaultSettings);delete value.moduleKeys[moduleId];const base=this.pm.getProfile(this.plugin.settingsManager.settings.activeProfileId);base.modules[moduleId]=copy(value.modules[moduleId]);base.moduleEnabled[moduleId]=false;if(moduleId==="bases"){meta.shapes={selected:"standard",options:{}};}}
  snapshot() {return copy(this.state);}
  legacyData(snapshot) {const value=copy(snapshot);for(const profile of value.customProfiles||[])if(profile.modules?.bases)delete profile.modules.bases.cardsShape;return value;}
  async backupSidecar(adapter,path) {
    // adapter.copy fails with EEXIST when the .bak already exists, so read and write (write overwrites). A failed backup never blocks the save and is logged once.
    try {
      if(await adapter.exists(path))await adapter.write(path+".bak",await adapter.read(path));
    } catch(error) {
      if(!this.backupWarned){this.backupWarned=true;console.warn("Customization Studio could not refresh studio-appearance.json.bak; saving without a new backup.",error);}
    }
  }
  async save(snapshot,state) {
    const adapter=this.plugin.app.vault.adapter,path=this.path,temp=path+".tmp";
    const next=this.legacyData(snapshot),document={...state,transaction:{before:this.persistedData??null,after:next}};
    await adapter.write(temp,JSON.stringify(document,null,2));
    await this.backupSidecar(adapter,path);
    await adapter.rename(temp,path);
    await this.plugin.saveData(next);this.persistedData=copy(next);
  }
}
module.exports={PresentationManager,detectMode,palette,copy};
