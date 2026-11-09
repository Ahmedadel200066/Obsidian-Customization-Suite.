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
    let tokenIndex = 0;
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
        let token = colorTokens.get(color);
        if (!token) {
          token = `c${tokenIndex++}`;
          colorTokens.set(color, token);
        }
        this.setColumnMarker(wrapper, token);
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

  setColumnMarker(element, token) {
    const attribute = "data-cs-kanban-column";
    let record = this.markedColumns.get(element);
    if (!record) {
      record = { previous: element.getAttribute(attribute), written: token };
      this.markedColumns.set(element, record);
    } else {
      record.written = token;
    }
    element.setAttribute(attribute, token);
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
  const image = settings.backgroundImage
    ? `linear-gradient(${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)}, ${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)}), linear-gradient(${rgba(settings.backgroundOverlay, 1 - settings.backgroundImageOpacity / 100)}, ${rgba(settings.backgroundOverlay, 1 - settings.backgroundImageOpacity / 100)}), url(${JSON.stringify(settings.backgroundImage)})`
    : "none";
  const dragStyles = {
    lift: "box-shadow: var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.25));",
    glow: "box-shadow: 0 0 0 2px var(--interactive-accent), 0 0 18px var(--interactive-accent);",
    ghost: "opacity: 0.55;",
    outline: "outline: 2px solid var(--interactive-accent); outline-offset: 2px;",
    smooth: "transition: box-shadow 180ms ease, opacity 180ms ease;"
  };
  const hoverShadows = [
    settings.hoverGlow ? "var(--cs-kanban-glow)" : "",
    settings.hoverLift ? "var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.25))" : ""
  ].filter(Boolean).join(", ");
  const columnColors = [...controller.columnColorTokens.entries()].map(([color, token]) => `
.kanban-plugin .kanban-plugin__lane-wrapper[data-cs-kanban-column="${token}"] .kanban-plugin__lane {
  background-color: ${rgba(color, settings.columnOpacity / 100)};
}`).join("\n");
  return `
.kanban-plugin {
  background-color: ${settings.backgroundOverlay};
  background-image: ${image};
  background-size: ${settings.backgroundSize};
  background-position: ${settings.backgroundPosition};
  background-repeat: no-repeat;
  --cs-kanban-card-background: ${rgba(settings.cardBackground, settings.cardOpacity / 100)};
  --cs-kanban-glow: 0 0 ${Math.round(settings.glowIntensity / 5)}px var(--interactive-accent);
}
.kanban-plugin .kanban-plugin__lane-wrapper {
  margin-inline-end: ${settings.columnSpacing}px;
}
.kanban-plugin .kanban-plugin__lane {
  background-color: ${rgba(settings.columnBackground, settings.columnOpacity / 100)};
  border-radius: ${settings.columnRadius}px;
  padding: ${settings.columnPadding}px;
  backdrop-filter: ${settings.columnBlur ? `blur(${settings.columnBlur}px)` : "none"};
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
  transition: box-shadow 180ms ease, opacity 180ms ease;
}
.kanban-plugin .kanban-plugin__lane-items .kanban-plugin__item:hover {
  ${hoverShadows ? `box-shadow: ${hoverShadows};` : ""}
}
.kanban-plugin .kanban-plugin__drag-container > .kanban-plugin__item-wrapper .kanban-plugin__item {
  ${dragStyles[settings.dragStyle]}
}
.kanban-plugin .is-dropping > .kanban-plugin__lane {
  ${settings.dragStyle === "outline" ? "outline: 2px solid var(--interactive-accent); outline-offset: 2px;" : ""}
  ${settings.dragStyle === "glow" ? "box-shadow: 0 0 18px var(--interactive-accent);" : ""}
}
${columnColors}`;
}

module.exports = { KanbanController, styles, AUTOMATIC_COLORS };
