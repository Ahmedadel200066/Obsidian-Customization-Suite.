const VARIABLE_MAP = {
  accentColor: ["--cs-accent-color", "--interactive-accent"],
  surfaceColor: ["--cs-surface-color", "--background-primary"],
  textColor: ["--cs-text-color", "--text-normal"],
  borderRadius: ["--cs-border-radius", "--radius-m"]
};

class ThemeEngine {
  constructor(plugin) {
    this.plugin = plugin;
    this.styles = new Map();
    this.body = plugin.app.workspace.containerEl.ownerDocument.body;
    this.previousClassState = null;
    this.previousProfile = null;
  }

  async loadCoreCss() {
    const configDir = this.plugin.app.vault.configDir.replace(/\/+$/, "");
    const path = `${configDir}/plugins/${this.plugin.manifest.id}/styles/core.css`;
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
    style.textContent = css;
  }

  apply(profile) {
    if (this.previousClassState === null) {
      this.previousClassState = this.body.classList.contains("customization-studio-enabled");
    }
    if (this.previousProfile === null) {
      this.previousProfile = this.body.dataset.customizationStudioProfile;
    }
    this.body.classList.add("customization-studio-enabled");
    this.body.dataset.customizationStudioProfile = profile.id;

    const declarations = [];
    for (const [key, [customProperty, obsidianProperty]] of Object.entries(VARIABLE_MAP)) {
      const value = profile.variables[key];
      if (value) {
        declarations.push(`${customProperty}: ${value};`);
        declarations.push(`${obsidianProperty}: var(${customProperty});`);
      }
    }
    this.setStyle(
      "variables",
      `body.customization-studio-enabled[data-customization-studio-profile="${profile.id}"] {\n  ${declarations.join("\n  ")}\n}`
    );
    this.setStyle("profile", profile.customCss || "");
  }

  unload() {
    if (this.previousClassState === false) {
      this.body.classList.remove("customization-studio-enabled");
    }
    if (this.previousProfile === undefined) {
      delete this.body.dataset.customizationStudioProfile;
    } else if (this.body.dataset.customizationStudioProfile === this.plugin.profileManager?.getActiveProfile()?.id) {
      this.body.dataset.customizationStudioProfile = this.previousProfile;
    }
    for (const style of this.styles.values()) {
      if (style.parentNode) style.remove();
    }
    this.styles.clear();
    this.previousClassState = null;
    this.previousProfile = null;
  }
}

module.exports = { ThemeEngine, VARIABLE_MAP };
