const { BaseModuleController } = require("../base-controller");
const { rgba } = require("../settings-utils");
const selectors = require("./selectors");

const AUTOMATIC_COLORS = [
  { words: ["backlog", "todo", "to do", "open", "new"], color: "#5577a8" },
  { words: ["doing", "in progress", "active", "started"], color: "#b47b38" },
  { words: ["review", "testing", "blocked"], color: "#9866a8" },
  { words: ["done", "complete", "completed", "closed"], color: "#478b68" }
];

class KanbanController extends BaseModuleController {
  constructor(plugin, manager, module) {
    super(plugin, manager, module);
    this.markedColumns = new Map();
    this.columnColorTokens = new Map();
    this.nextColumnToken = 0;
    this.resolvedBackgroundImage = "";
    this.backgroundResolutionPath = null;
    this.backgroundResolutionRequest = 0;
  }

  updateStyle() {
    const image = this.settings.backgroundImage.trim();
    if (!image || /^https?:\/\//i.test(image)) {
      this.resolvedBackgroundImage = image;
      this.backgroundResolutionPath = null;
      this.backgroundResolutionRequest += 1;
      super.updateStyle();
      return;
    }

    super.updateStyle();
    if (this.backgroundResolutionPath === image) return;
    this.backgroundResolutionPath = image;
    const request = ++this.backgroundResolutionRequest;
    this.resolveBackgroundImage(image, request);
  }

  deactivate() {
    this.backgroundResolutionRequest += 1;
    this.backgroundResolutionPath = null;
    this.resolvedBackgroundImage = "";
    super.deactivate();
  }

  async resolveBackgroundImage(path, request) {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!file || typeof file.extension !== "string" || typeof file.path !== "string") {
        throw new Error(`Vault image "${path}" was not found.`);
      }
      if (!["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"].includes(file.extension.toLowerCase())) {
        throw new Error(`"${path}" is not a supported image file.`);
      }
      const resourcePath = this.plugin.app.vault.getResourcePath(file);
      if (typeof resourcePath !== "string" || !resourcePath) {
        throw new Error(`Obsidian could not resolve the resource path for "${path}".`);
      }
      if (request !== this.backgroundResolutionRequest || path !== this.settings.backgroundImage) return;
      if (this.roots.size === 0) {
        this.backgroundResolutionPath = null;
        return;
      }
      this.resolvedBackgroundImage = resourcePath;
      super.updateStyle();
    } catch (error) {
      if (request !== this.backgroundResolutionRequest) return;
      this.resolvedBackgroundImage = "";
      super.updateStyle();
      console.warn(`[Customization Studio] Could not resolve Kanban background image "${path}".`, error);
      this.plugin.notifyUser(`Customization Studio: ${error.message}`);
    }
  }

  onRootsUpdated(roots) {
    this.updateColumnDecorations(roots);
  }

  onDomChanged() {
    this.updateColumnDecorations(new Set(this.roots.keys()));
  }

  onRootRemoved(root) {
    for (const [element, record] of this.markedColumns) {
      if (root === element || root.contains(element)) this.restoreColumnMarker(element, record);
    }
  }

  updateColumnDecorations(roots) {
    const active = new Set();
    const colorTokens = new Map();
    for (const root of roots) {
      for (const wrapper of root.querySelectorAll(selectors.laneWrapper)) {
        const title = wrapper.querySelector(selectors.laneTitle)?.textContent?.trim();
        if (!title) continue;
        active.add(wrapper);
        const color = this.getColumnColor(title);
        if (!color) {
          this.removeColumnMarker(wrapper);
          continue;
        }
        const token = this.setColumnMarker(wrapper);
        if (token) colorTokens.set(token, color);
      }
    }
    for (const [element, record] of this.markedColumns) {
      if (!active.has(element)) this.restoreColumnMarker(element, record);
    }
    this.columnColorTokens = colorTokens;
  }

  getColumnColor(title) {
    const normalized = title.trim().toLowerCase();
    const manual = Object.entries(this.settings.columnColors)
      .find(([name]) => name.trim().toLowerCase() === normalized)?.[1];
    if (manual) return manual;
    if (!this.settings.automaticColumnColors) return null;
    return AUTOMATIC_COLORS.find(({ words }) => words.includes(normalized))?.color || null;
  }

  setColumnMarker(element) {
    const attribute = "data-cs-kanban-column";
    let record = this.markedColumns.get(element);
    if (!record) {
      const previous = element.getAttribute(attribute);
      if (previous !== null) return null;
      record = { previous, written: `c${this.nextColumnToken++}` };
      this.markedColumns.set(element, record);
    }
    element.setAttribute(attribute, record.written);
    return record.written;
  }

  removeColumnMarker(element) {
    const record = this.markedColumns.get(element);
    if (record) this.restoreColumnMarker(element, record);
  }

  restoreColumnMarker(element, record) {
    const attribute = "data-cs-kanban-column";
    if (element.getAttribute(attribute) === record.written) {
      if (record.previous === null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, record.previous);
    }
    this.markedColumns.delete(element);
  }

  getColumnNames() {
    const names = new Set();
    for (const root of this.roots.keys()) {
      for (const wrapper of root.querySelectorAll(selectors.laneWrapper)) {
        const title = wrapper.querySelector(selectors.laneTitle)?.textContent?.trim();
        if (title) names.add(title);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  unload() {
    for (const [element, record] of this.markedColumns) this.restoreColumnMarker(element, record);
    this.columnColorTokens.clear();
    super.unload();
  }
}

function styles(settings, controller) {
  const imageSource = controller.resolvedBackgroundImage;
  const image = imageSource
    ? `linear-gradient(${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)}, ${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)}), linear-gradient(${rgba(settings.backgroundOverlay, 1 - settings.backgroundImageOpacity / 100)}, ${rgba(settings.backgroundOverlay, 1 - settings.backgroundImageOpacity / 100)}), url(${JSON.stringify(imageSource)})`
    : "none";
  const cardGlow = `0 0 ${settings.cardGlowBlur}px ${rgba(settings.cardGlowColor, settings.glowIntensity / 100)}`;
  const columnGlow = `0 0 ${settings.columnGlowBlur}px ${rgba(settings.columnGlowColor, settings.columnGlowIntensity / 100)}`;
  const dragStyles = {
    lift: "box-shadow: var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.25));",
    glow: "box-shadow: 0 0 0 2px var(--interactive-accent), 0 0 18px var(--interactive-accent);",
    ghost: "opacity: 0.55;",
    outline: "outline: 2px solid var(--interactive-accent); outline-offset: 2px;",
    smooth: "transition: box-shadow 180ms ease, opacity 180ms ease;"
  };
  const hoverShadows = settings.hoverLift
    ? "var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.25))"
    : "";
  const cardGlowSelector = settings.cardGlowMode === "always"
    ? ".kanban-plugin .kanban-plugin__item"
    : ".kanban-plugin .kanban-plugin__lane-items .kanban-plugin__item:hover";
  const columnGlowSelector = settings.columnGlowMode === "always"
    ? ".kanban-plugin .kanban-plugin__lane"
    : ".kanban-plugin .kanban-plugin__lane:hover";
  const columnColors = [...controller.columnColorTokens.entries()].map(([token, color]) => `
.kanban-plugin .kanban-plugin__lane-wrapper[data-cs-kanban-column="${token}"] .kanban-plugin__lane {
  background-color: ${rgba(color, settings.columnBlur ? Math.min(settings.columnOpacity / 100, 0.75) : settings.columnOpacity / 100)};
}`).join("\n");
  return `
.kanban-plugin {
  background-color: ${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)};
  background-image: ${image};
  background-size: ${settings.backgroundSize};
  background-position: ${settings.backgroundPosition};
  background-repeat: no-repeat;
  --cs-kanban-card-background: ${rgba(settings.cardBackground, settings.cardOpacity / 100)};
}
.kanban-plugin .kanban-plugin__lane-wrapper {
  margin-inline-end: ${settings.columnSpacing}px;
}
.kanban-plugin .kanban-plugin__lane {
  background-color: ${rgba(settings.columnBackground, settings.columnBlur ? Math.min(settings.columnOpacity / 100, 0.75) : settings.columnOpacity / 100)};
  border-radius: ${settings.columnRadius}px;
  padding: ${settings.columnPadding}px;
  backdrop-filter: ${settings.columnBlur ? `blur(${settings.columnBlur}px)` : "none"};
  -webkit-backdrop-filter: ${settings.columnBlur ? `blur(${settings.columnBlur}px)` : "none"};
  transition: background-color 180ms ease, box-shadow 180ms ease, outline-color 180ms ease;
}
.kanban-plugin .kanban-plugin__lane-items {
  gap: ${settings.cardSpacing}px;
}
.kanban-plugin .kanban-plugin__lane-items > div {
  margin-block-start: 0;
}
.kanban-plugin .kanban-plugin__item,
.kanban-plugin .kanban-plugin__item-content-wrapper,
.kanban-plugin .kanban-plugin__item-title-wrapper {
  background-color: var(--cs-kanban-card-background);
}
.kanban-plugin .kanban-plugin__item {
  border-radius: ${settings.cardRadius}px;
  padding: ${settings.cardPadding}px;
  transition: box-shadow 180ms ease, opacity 180ms ease, outline-color 180ms ease;
}
.kanban-plugin .kanban-plugin__lane-items .kanban-plugin__item:hover {
  ${hoverShadows ? `box-shadow: ${hoverShadows};` : ""}
}
${settings.hoverGlow ? `${cardGlowSelector} { box-shadow: ${cardGlow}; }` : ""}
${settings.columnGlowEnabled ? `${columnGlowSelector} { box-shadow: ${columnGlow}; }` : ""}
.kanban-plugin .kanban-plugin__drag-container > .kanban-plugin__item-wrapper .kanban-plugin__item {
  ${dragStyles[settings.dragStyle]}
}
.kanban-plugin .is-dropping > .kanban-plugin__lane {
  ${settings.dragStyle === "outline" ? "outline: 2px solid var(--interactive-accent); outline-offset: 2px;" : ""}
  ${settings.dragStyle === "glow" ? "box-shadow: 0 0 18px var(--interactive-accent);" : ""}
}
@media (prefers-reduced-motion: reduce) {
  .kanban-plugin .kanban-plugin__item,
  .kanban-plugin .kanban-plugin__lane {
    transition-duration: 0ms !important;
  }
}
${columnColors}`;
}

module.exports = { KanbanController, styles, AUTOMATIC_COLORS };
