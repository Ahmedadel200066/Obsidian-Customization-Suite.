const { normalizePath } = require("obsidian");
const VARIABLE_MAP = {
  accentColor: ["--cs-accent-color", "--interactive-accent"],
  surfaceColor: ["--cs-surface-color", "--background-primary"],
  textColor: ["--cs-text-color", "--text-normal"]
};

function colorWithOpacity(hex, opacity) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(", ")}, ${opacity})`;
}

function tabBarGradient(variables) {
  if (variables.tabBarGradientIntensity === 0) return "none";
  const color = colorWithOpacity(
    variables.tabBarGradientColor,
    variables.tabBarGradientIntensity / 100
  );
  if (variables.tabBarGradientType === "radial") {
    return `radial-gradient(ellipse at ${variables.tabBarGradientPosition}, ${color}, transparent)`;
  }
  if (variables.tabBarGradientType === "circle") {
    return `radial-gradient(circle at ${variables.tabBarGradientPosition}, ${color}, transparent)`;
  }
  return `linear-gradient(${variables.tabBarGradientDirection}, ${color}, transparent)`;
}

class ThemeEngine {
  constructor(plugin, body = null) {
    this.plugin = plugin;
    this.styles = new Map();
    this.body = body || plugin.app.workspace.containerEl.ownerDocument.body;
    this.isSecondaryDocument = Boolean(body);
    this.documentEngines = new Map();
    this.previousClassState = null;
    this.previousProfile = null;
    this.appliedProfileId = null;
  }

  async loadCoreCss() {
    const configDir = this.plugin.app.vault.configDir.replace(/\/+$/, "");
    const pluginDir = (this.plugin.manifest.dir || `${configDir}/plugins/${this.plugin.manifest.id}`).replace(/\/+$/, "");
    const path = normalizePath(`${pluginDir}/styles.css`);
    try {
      const css = await this.plugin.app.vault.adapter.read(path);
      this.setStyle("core", css);
      return true;
    } catch (error) {
      console.warn(`Customization Studio could not load optional stylesheet "${path}".`, error);
      this.plugin.notifyUser("Customization Studio loaded without its optional settings stylesheet. Check the plugin installation folder.");
      return false;
    }
  }

  setStyle(id, css) {
    let style = this.styles.get(id);
    if (!style || !style.parentNode) {
      style = this.body.ownerDocument.createElement("style");
      style.dataset.customizationStudioStyle = id;
      style.dataset.customizationStudioOwner = this.plugin.manifest.id;
      this.body.ownerDocument.head.appendChild(style);
      this.styles.set(id, style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  apply(profile) {
    if (this.plugin.settingsManager?.settings.customizationEnabled === false) { this.pause(); return; }
    profile=this.plugin.presentation?.resolveProfile(profile.id,this.body)||profile;
    if (!this.isSecondaryDocument) {
      const documents = this.plugin.moduleManager?.getDocuments?.() || new Set([this.body.ownerDocument]);
      for (const [doc, engine] of this.documentEngines) {
        if (!documents.has(doc)) {
          engine.unload();
          this.documentEngines.delete(doc);
        }
      }
      for (const doc of documents) {
        if (doc === this.body.ownerDocument) continue;
        let engine = this.documentEngines.get(doc);
        if (!engine) {
          engine = new ThemeEngine(this.plugin, doc.body);
          const coreCss = this.styles.get("core")?.textContent;
          if (coreCss) engine.setStyle("core", coreCss);
          this.documentEngines.set(doc, engine);
        }
        engine.apply(profile);
      }
    }
    const inherited=profile.studio?.neutral&&profile.studio.appearance==="auto";
    const keys=inherited?profile.studio.globalKeys:Object.keys(profile.variables);
    const declarations=[];
    for(const [key,[customProperty,obsidianProperty]]of Object.entries(VARIABLE_MAP))if(keys.includes(key)){
      declarations.push(`${customProperty}: ${profile.variables[key]};`,`${obsidianProperty}: var(${customProperty});`);
    }
    if(profile.studio&&!inherited){
      const p=profile.studio.palette;
      for(const [name,value]of Object.entries({"--background-primary-alt":p.secondary,"--background-secondary":p.secondary,"--background-secondary-alt":p.secondaryAlt,"--background-modifier-border":p.border,"--background-modifier-border-hover":p.muted,"--background-modifier-hover":p.hover,"--text-muted":p.muted,"--text-faint":p.faint,"--text-accent":p.accent,"--text-on-accent":p.onAccent,"--interactive-accent-hover":p.accent,"--interactive-normal":p.secondary,"--interactive-hover":p.hover,"--background-modifier-form-field":p.secondary}))declarations.push(`${name}: ${value};`);
      declarations.push(`color-scheme: ${profile.studio.mode};`);
    }else if(keys.includes("accentColor"))declarations.push(`--text-accent: ${profile.variables.accentColor};`);
    const tab=[];
    if(!inherited||keys.includes("tabBarOpacity"))tab.push(`background-color: ${profile.variables.tabBarOpacity===0?"transparent":colorWithOpacity(profile.variables.surfaceColor,profile.variables.tabBarOpacity/100)};`);
    if(!inherited||keys.some(k=>k.startsWith("tabBarGradient")))tab.push(`background-image: ${tabBarGradient(profile.variables)};`);
    if(!inherited||keys.includes("tabBarBlur"))tab.push(`backdrop-filter: blur(${profile.variables.tabBarBlur}px);`,`-webkit-backdrop-filter: blur(${profile.variables.tabBarBlur}px);`);
    if(!declarations.length&&!tab.length&&!profile.customCss){this.clearEffects(true);return;}
    if(this.previousClassState===null)this.previousClassState=this.body.classList.contains("customization-studio-enabled");
    if(this.previousProfile===null)this.previousProfile=this.body.dataset.customizationStudioProfile;
    this.body.classList.add("customization-studio-enabled");this.body.dataset.customizationStudioProfile=profile.id;this.appliedProfileId=profile.id;
    const selector=`body.customization-studio-enabled[data-customization-studio-profile="${profile.id}"]`;
    this.setStyle("variables",`${selector}{${declarations.join("\n")}}${tab.length?`${selector} .workspace-tab-header-container{${tab.join("\n")}}`:""}`);
    this.setStyle("profile",profile.customCss||"");
  }

  clearEffects(keepCore = false) {
    if (this.previousClassState !== null) {
      if (this.previousClassState === false) this.body.classList.remove("customization-studio-enabled");
      if (this.body.dataset.customizationStudioProfile === this.appliedProfileId) {
        if (this.previousProfile === undefined) delete this.body.dataset.customizationStudioProfile;
        else this.body.dataset.customizationStudioProfile = this.previousProfile;
      }
    }
    for (const [id, style] of this.styles) {
      if (keepCore && id === "core") continue;
      if (style.parentNode) style.remove();
      this.styles.delete(id);
    }
    this.previousClassState = null;
    this.previousProfile = null;
    this.appliedProfileId = null;
  }

  pause() {
    for (const engine of this.documentEngines.values()) engine.pause();
    this.clearEffects(true);
  }

  unload() {
    for (const engine of this.documentEngines.values()) engine.unload();
    this.documentEngines.clear();
    this.clearEffects(false);
  }
}

module.exports = { ThemeEngine, VARIABLE_MAP, colorWithOpacity, tabBarGradient };
