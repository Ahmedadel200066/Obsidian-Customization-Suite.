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
    this.coreCssPromise = plugin.app.vault.adapter.read(
      `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/styles/core.css`
    );
  }

  async loadCoreCss() {
    const css = await this.coreCssPromise;
    this.setStyle("core", css);
  }

  setStyle(id, css) {
    let style = this.styles.get(id);
    if (!style) {
      style = this.body.ownerDocument.createElement("style");
      style.dataset.customizationStudioStyle = id;
      this.body.ownerDocument.head.appendChild(style);
      this.styles.set(id, style);
      this.plugin.register(() => style.remove());
    }
    style.textContent = css;
  }

  apply(profile) {
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
    this.setStyle("profile", profile.customCss);
  }

  unload() {
    this.body.classList.remove("customization-studio-enabled");
    delete this.body.dataset.customizationStudioProfile;
    for (const style of this.styles.values()) style.remove();
    this.styles.clear();
  }
}

module.exports = { ThemeEngine };
