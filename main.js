/*
MIT License

Copyright (c) 2026 Ahmed Adel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// core/settings-manager.js
var require_settings_manager = __commonJS({
  "core/settings-manager.js"(exports2, module2) {
    var DEFAULT_SETTINGS = {
      activeProfileId: "minimal",
      customProfiles: [],
      moduleEnabled: {},
      uiState: {
        settingsTab: { section: "profiles", moduleId: "kanban", scrollTop: 0 },
        ribbonModal: { section: "profiles", moduleId: "kanban", scrollTop: 0 }
      }
    };
    var UI_SECTIONS = /* @__PURE__ */ new Set(["global", "profiles", "integrations"]);
    function validateUiState(value) {
      if (value === void 0) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Customization Studio uiState setting must be an object.");
      }
      const result = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState));
      for (const key of ["settingsTab", "ribbonModal"]) {
        const saved = value[key];
        if (saved === void 0) continue;
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
          throw new Error(`Customization Studio uiState.${key} must be an object.`);
        }
        const section = saved.section ?? result[key].section;
        const moduleId = saved.moduleId ?? result[key].moduleId;
        const scrollTop = saved.scrollTop ?? result[key].scrollTop;
        if (!UI_SECTIONS.has(section) || typeof moduleId !== "string" || !/^[a-z0-9-]{1,64}$/.test(moduleId) || typeof scrollTop !== "number" || !Number.isFinite(scrollTop) || scrollTop < 0 || scrollTop > 1e7) {
          throw new Error(`Customization Studio uiState.${key} contains invalid navigation state.`);
        }
        result[key] = { section, moduleId, scrollTop };
      }
      return result;
    }
    var SettingsManager2 = class {
      constructor(plugin, debounceMs = 300) {
        this.plugin = plugin;
        this.settings = {
          ...DEFAULT_SETTINGS,
          uiState: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState))
        };
        this.debounceMs = debounceMs;
        this.revision = 0;
        this.dirty = false;
        this.timer = null;
        this.flushPromise = null;
        this.saveQueue = Promise.resolve();
        this.waiters = [];
      }
      async load() {
        const data = await this.plugin.loadData();
        if (data == null) {
          this.settings = {
            ...DEFAULT_SETTINGS,
            uiState: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.uiState))
          };
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
          moduleEnabled: { ...moduleEnabled },
          uiState: validateUiState(data.uiState)
        };
      }
      scheduleSave(delay = this.debounceMs) {
        this.dirty = true;
        this.revision += 1;
        const promise = new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flush().then(
            () => this.settleWaiters(),
            (error) => this.settleWaiters(error)
          );
        }, delay);
        return promise;
      }
      async save() {
        return this.scheduleSave(0);
      }
      async flush() {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.flushPromise) {
          await this.flushPromise;
          if (this.dirty) return this.flush();
          return;
        }
        if (!this.dirty) return;
        const snapshot = JSON.parse(JSON.stringify(this.settings));
        const savedRevision = this.revision;
        this.dirty = false;
        const pending = this.saveQueue.catch(() => void 0).then(() => this.plugin.saveData(snapshot));
        this.saveQueue = pending;
        this.flushPromise = pending;
        try {
          await pending;
          if (this.revision !== savedRevision) this.dirty = true;
        } catch (error) {
          this.dirty = true;
          throw error;
        } finally {
          this.flushPromise = null;
        }
        if (this.dirty) return this.flush();
      }
      settleWaiters(error) {
        const waiters = this.waiters.splice(0);
        for (const waiter of waiters) {
          if (error) waiter.reject(error);
          else waiter.resolve();
        }
      }
    };
    module2.exports = { DEFAULT_SETTINGS, SettingsManager: SettingsManager2, validateUiState };
  }
});

// modules/settings-utils.js
var require_settings_utils = __commonJS({
  "modules/settings-utils.js"(exports2, module2) {
    function createDefaults(schema) {
      const defaults = {};
      for (const [key, definition] of Object.entries(schema)) {
        defaults[key] = typeof definition.default === "object" && definition.default !== null ? JSON.parse(JSON.stringify(definition.default)) : definition.default;
      }
      return defaults;
    }
    function validateSettings(moduleName, value, schema) {
      if (value == null) value = {};
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${moduleName} settings must be an object.`);
      }
      const result = createDefaults(schema);
      for (const [key, incoming] of Object.entries(value)) {
        const definition = schema[key];
        if (!definition) throw new Error(`${moduleName} has an unsupported setting "${key}".`);
        if (definition.type === "colorMap") {
          if (typeof incoming !== "object" || incoming === null || Array.isArray(incoming)) {
            throw new Error(`${moduleName} ${key} must be an object of color overrides.`);
          }
          const entries = {};
          for (const [name, color] of Object.entries(incoming)) {
            if (!name.trim() || name.length > 80 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
              throw new Error(`${moduleName} ${key} contains an invalid column name or color.`);
            }
            entries[name] = color;
          }
          result[key] = entries;
          continue;
        }
        switch (definition.type) {
          case "boolean":
            if (typeof incoming !== "boolean") {
              throw new Error(`${moduleName} ${key} must be a boolean.`);
            }
            break;
          case "color":
            if (typeof incoming !== "string" || !/^#[0-9a-fA-F]{6}$/.test(incoming)) {
              throw new Error(`${moduleName} ${key} must be a six-digit hex color.`);
            }
            break;
          case "range":
            if (typeof incoming !== "number" || !Number.isFinite(incoming) || incoming < definition.min || incoming > definition.max) {
              throw new Error(`${moduleName} ${key} must be between ${definition.min} and ${definition.max}.`);
            }
            break;
          case "select":
            if (!definition.options.includes(incoming)) {
              throw new Error(`${moduleName} ${key} is not a supported option.`);
            }
            break;
          case "text":
            if (typeof incoming !== "string" || incoming.length > (definition.maxLength || 2e3)) {
              throw new Error(`${moduleName} ${key} must be text no longer than ${definition.maxLength || 2e3} characters.`);
            }
            if (definition.url && incoming !== "" && !/^https?:\/\/[^\s"'<>]+$/i.test(incoming)) {
              throw new Error(`${moduleName} ${key} must be an HTTP or HTTPS URL.`);
            }
            break;
          default:
            throw new Error(`${moduleName} has an invalid setting schema for "${key}".`);
        }
        result[key] = incoming;
      }
      return result;
    }
    function rgba(hex, alpha) {
      const value = hex.slice(1);
      const red = Number.parseInt(value.slice(0, 2), 16);
      const green = Number.parseInt(value.slice(2, 4), 16);
      const blue = Number.parseInt(value.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    module2.exports = { createDefaults, validateSettings, rgba };
  }
});

// modules/kanban/settings.js
var require_settings = __commonJS({
  "modules/kanban/settings.js"(exports2, module2) {
    var { normalizePath } = require("obsidian");
    var { createDefaults, validateSettings } = require_settings_utils();
    var SCHEMA = {
      automaticColumnColors: { type: "boolean", default: true },
      columnColors: { type: "colorMap", default: {} },
      columnBackground: { type: "color", default: "#343a46" },
      columnOpacity: { type: "range", default: 100, min: 0, max: 100 },
      cardBackground: { type: "color", default: "#222630" },
      cardOpacity: { type: "range", default: 100, min: 0, max: 100 },
      columnRadius: { type: "range", default: 8, min: 0, max: 32 },
      cardRadius: { type: "range", default: 6, min: 0, max: 32 },
      columnSpacing: { type: "range", default: 12, min: 0, max: 48 },
      columnPadding: { type: "range", default: 10, min: 0, max: 40 },
      cardSpacing: { type: "range", default: 8, min: 0, max: 32 },
      cardPadding: { type: "range", default: 8, min: 0, max: 32 },
      columnBlur: { type: "range", default: 0, min: 0, max: 20 },
      columnGlowEnabled: { type: "boolean", default: false },
      columnGlowColor: { type: "color", default: "#7c6ce7" },
      columnGlowIntensity: { type: "range", default: 35, min: 0, max: 100 },
      columnGlowBlur: { type: "range", default: 18, min: 0, max: 80 },
      columnGlowMode: { type: "select", default: "hover", options: ["hover", "always"] },
      backgroundImage: { type: "text", default: "", maxLength: 2048 },
      backgroundImageOpacity: { type: "range", default: 25, min: 0, max: 100 },
      backgroundOverlay: { type: "color", default: "#000000" },
      backgroundOverlayOpacity: { type: "range", default: 15, min: 0, max: 100 },
      backgroundSize: { type: "select", default: "cover", options: ["cover", "contain", "auto", "100% 100%"] },
      backgroundPosition: {
        type: "select",
        default: "center center",
        options: ["center center", "center top", "center bottom", "left center", "right center"]
      },
      hoverGlow: { type: "boolean", default: true },
      glowIntensity: { type: "range", default: 35, min: 0, max: 100 },
      cardGlowColor: { type: "color", default: "#7c6ce7" },
      cardGlowBlur: { type: "range", default: 18, min: 0, max: 80 },
      cardGlowMode: { type: "select", default: "hover", options: ["hover", "always"] },
      hoverLift: { type: "boolean", default: true },
      dragStyle: { type: "select", default: "lift", options: ["lift", "glow", "ghost", "outline", "smooth"] },
      customCss: { type: "text", default: "", maxLength: 1e4 }
    };
    var CONTROL_GROUPS = [
      {
        name: "Columns",
        controls: [
          { key: "automaticColumnColors", name: "Color columns by name", type: "boolean" },
          { key: "columnBackground", name: "Default column color", type: "color" },
          { key: "columnRadius", name: "Column corner radius", type: "range", unit: "px" },
          { key: "columnSpacing", name: "Column spacing", type: "range", unit: "px" },
          { key: "columnPadding", name: "Column padding", type: "range", unit: "px" }
        ]
      },
      {
        name: "Colors",
        controls: [
          { key: "columnOpacity", name: "Column opacity", type: "range", unit: "%" },
          { key: "cardBackground", name: "Card color", type: "color" },
          { key: "cardOpacity", name: "Card opacity", type: "range", unit: "%" }
        ]
      },
      {
        name: "Cards",
        controls: [
          { key: "cardRadius", name: "Card corner radius", type: "range", unit: "px" },
          { key: "cardSpacing", name: "Card spacing", type: "range", unit: "px" },
          { key: "cardPadding", name: "Card padding", type: "range", unit: "px" },
          { key: "hoverLift", name: "Lift on hover", type: "boolean" }
        ]
      },
      {
        name: "Blur",
        controls: [{
          key: "columnBlur",
          name: "Column blur",
          type: "range",
          unit: "px",
          desc: "Blur is visible through a translucent lane surface; enabling blur caps lane opacity at 75%."
        }]
      },
      {
        name: "Glow",
        controls: [
          { key: "hoverGlow", name: "Enable card glow", type: "boolean" },
          { key: "glowIntensity", name: "Card glow intensity", type: "range", unit: "%" },
          { key: "cardGlowColor", name: "Card glow color", type: "color" },
          { key: "cardGlowBlur", name: "Card glow blur", type: "range", unit: "px" },
          { key: "cardGlowMode", name: "Card glow mode", type: "select" },
          { key: "columnGlowEnabled", name: "Enable column glow", type: "boolean" },
          { key: "columnGlowColor", name: "Column glow color", type: "color" },
          { key: "columnGlowIntensity", name: "Column glow intensity", type: "range", unit: "%" },
          { key: "columnGlowBlur", name: "Column glow blur", type: "range", unit: "px" },
          { key: "columnGlowMode", name: "Column glow mode", type: "select" }
        ]
      },
      {
        name: "Board background",
        controls: [
          { key: "backgroundImage", name: "Vault image path or external URL", type: "text" },
          { key: "backgroundImageOpacity", name: "Image opacity", type: "range", unit: "%" },
          { key: "backgroundOverlay", name: "Overlay color", type: "color" },
          { key: "backgroundOverlayOpacity", name: "Overlay opacity", type: "range", unit: "%" },
          { key: "backgroundSize", name: "Image sizing", type: "select" },
          { key: "backgroundPosition", name: "Image position", type: "select" }
        ]
      },
      {
        name: "Drag and Drop",
        controls: [{ key: "dragStyle", name: "Drag visual style", type: "select" }]
      }
    ];
    function validate(value) {
      const result = validateSettings("Kanban", value, SCHEMA);
      const image = result.backgroundImage.trim();
      if (!image) {
        result.backgroundImage = "";
        return result;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(image)) {
        let url;
        try {
          url = new URL(image);
        } catch {
          throw new Error("Kanban background image must be a valid vault path or HTTP(S) URL.");
        }
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Kanban background image URLs must use HTTP or HTTPS.");
        }
        result.backgroundImage = url.href;
        return result;
      }
      const normalizedPath = image.replace(/\\/g, "/").replace(/^\.\/+/, "");
      if (normalizedPath.startsWith("/") || /^[a-z]:\//i.test(normalizedPath) || normalizedPath.split("/").some((part) => part === "..") || /[\u0000-\u001f]/.test(normalizedPath)) {
        throw new Error("Kanban background image must be a relative path inside the vault.");
      }
      result.backgroundImage = normalizePath(normalizedPath);
      return result;
    }
    module2.exports = {
      SCHEMA,
      CONTROL_GROUPS,
      DEFAULT_SETTINGS: createDefaults(SCHEMA),
      validate
    };
  }
});

// modules/base-controller.js
var require_base_controller = __commonJS({
  "modules/base-controller.js"(exports2, module2) {
    var BaseModuleController = class {
      constructor(plugin, manager, module3) {
        this.plugin = plugin;
        this.manager = manager;
        this.module = module3;
        this.roots = /* @__PURE__ */ new Map();
        this.style = null;
        this.styles = /* @__PURE__ */ new Map();
        this.profile = null;
        this.settings = module3.validateSettings();
        this.pendingApply = null;
      }
      start() {
        this.refresh(this.plugin.profileManager.getActiveProfile());
      }
      refresh(profile) {
        this.profile = profile;
        this.settings = this.module.validateSettings(profile.modules[this.module.id]);
        if (profile.moduleEnabled[this.module.id] === false || !this.manager.isTargetPluginEnabled(this.module)) {
          this.deactivate();
          return;
        }
        const container = this.plugin.app.workspace.containerEl;
        const documents = this.manager.getDocuments?.() || /* @__PURE__ */ new Set([container.ownerDocument]);
        const roots = /* @__PURE__ */ new Set();
        for (const doc of documents) {
          for (const root of doc.body.querySelectorAll(this.module.rootSelector)) roots.add(root);
        }
        for (const root of container.querySelectorAll(this.module.rootSelector)) roots.add(root);
        for (const [root, observer] of this.roots) {
          if (!roots.has(root)) {
            observer?.disconnect();
            this.roots.delete(root);
            this.onRootRemoved(root);
          }
        }
        for (const root of roots) {
          if (!this.roots.has(root)) this.observeRoot(root);
        }
        if (roots.size === 0) {
          this.removeStyle();
          return;
        }
        this.onRootsUpdated(roots);
        this.updateStyle();
      }
      observeRoot(root) {
        const Observer = root.ownerDocument.defaultView?.MutationObserver || globalThis.MutationObserver;
        if (!Observer) {
          this.roots.set(root, null);
          return;
        }
        const observer = new Observer(() => this.scheduleApply(root));
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        this.roots.set(root, observer);
      }
      scheduleApply(root) {
        if (this.pendingApply !== null) return;
        this.pendingApply = setTimeout(() => {
          this.pendingApply = null;
          if (!this.roots.has(root)) return;
          this.onDomChanged(root);
          this.updateStyle();
        }, 40);
      }
      updateStyle() {
        const documents = new Set([...this.roots.keys()].map((root) => root.ownerDocument));
        for (const [doc, style] of this.styles) {
          if (!documents.has(doc)) {
            style.remove();
            this.styles.delete(doc);
          }
        }
        const css = `${this.module.styles(this.settings, this)}
${this.module.customCss(this.settings, this)}`;
        for (const doc of documents) {
          let style = this.styles.get(doc);
          if (!style?.parentNode) {
            style = doc.createElement("style");
            style.dataset.customizationStudioModule = this.module.id;
            style.dataset.customizationStudioOwner = this.plugin.manifest.id;
            doc.head.appendChild(style);
            this.styles.set(doc, style);
          }
          if (style.textContent !== css) style.textContent = css;
        }
        this.style = this.styles.get(this.plugin.app.workspace.containerEl.ownerDocument) || this.styles.values().next().value || null;
      }
      onRootsUpdated() {
      }
      onDomChanged() {
      }
      onRootRemoved() {
      }
      removeStyle() {
        for (const style of this.styles.values()) if (style.parentNode) style.remove();
        this.styles.clear();
        this.style = null;
      }
      deactivate() {
        if (this.pendingApply !== null) {
          clearTimeout(this.pendingApply);
          this.pendingApply = null;
        }
        for (const [root, observer] of this.roots) {
          observer?.disconnect();
          this.onRootRemoved(root);
        }
        this.roots.clear();
        this.removeStyle();
      }
      unload() {
        this.deactivate();
      }
    };
    module2.exports = { BaseModuleController };
  }
});

// modules/kanban/selectors.js
var require_selectors = __commonJS({
  "modules/kanban/selectors.js"(exports2, module2) {
    module2.exports = {
      root: ".kanban-plugin, .kanban-plugin__drag-container",
      board: ".kanban-plugin__board",
      laneWrapper: ".kanban-plugin__lane-wrapper",
      lane: ".kanban-plugin__lane",
      laneTitle: ".kanban-plugin__lane-title-text",
      laneItems: ".kanban-plugin__lane-items",
      card: ".kanban-plugin__item",
      draggedCard: ".kanban-plugin__drag-container > .kanban-plugin__item-wrapper .kanban-plugin__item",
      droppingLane: ".is-dropping > .kanban-plugin__lane"
    };
  }
});

// modules/kanban/controller.js
var require_controller = __commonJS({
  "modules/kanban/controller.js"(exports2, module2) {
    var { BaseModuleController } = require_base_controller();
    var { rgba } = require_settings_utils();
    var selectors = require_selectors();
    var AUTOMATIC_COLORS = [
      { words: ["backlog", "todo", "to do", "open", "new"], color: "#5577a8" },
      { words: ["doing", "in progress", "active", "started"], color: "#b47b38" },
      { words: ["review", "testing", "blocked"], color: "#9866a8" },
      { words: ["done", "complete", "completed", "closed"], color: "#478b68" }
    ];
    var KanbanController = class extends BaseModuleController {
      constructor(plugin, manager, module3) {
        super(plugin, manager, module3);
        this.markedColumns = /* @__PURE__ */ new Map();
        this.columnColorTokens = /* @__PURE__ */ new Map();
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
        const active = /* @__PURE__ */ new Set();
        const colorTokens = /* @__PURE__ */ new Map();
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
        const manual = Object.entries(this.settings.columnColors).find(([name]) => name.trim().toLowerCase() === normalized)?.[1];
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
        const names = /* @__PURE__ */ new Set();
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
    };
    function styles(settings, controller) {
      const imageSource = controller.resolvedBackgroundImage;
      const image = imageSource ? `linear-gradient(${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)}, ${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)}), linear-gradient(${rgba(settings.backgroundOverlay, 1 - settings.backgroundImageOpacity / 100)}, ${rgba(settings.backgroundOverlay, 1 - settings.backgroundImageOpacity / 100)}), url(${JSON.stringify(imageSource)})` : "none";
      const cardGlow = `0 0 ${settings.cardGlowBlur}px ${rgba(settings.cardGlowColor, settings.glowIntensity / 100)}`;
      const columnGlow = `0 0 ${settings.columnGlowBlur}px ${rgba(settings.columnGlowColor, settings.columnGlowIntensity / 100)}`;
      const dragStyles = {
        lift: "box-shadow: var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.25));",
        glow: "box-shadow: 0 0 0 2px var(--interactive-accent), 0 0 18px var(--interactive-accent);",
        ghost: "opacity: 0.55;",
        outline: "outline: 2px solid var(--interactive-accent); outline-offset: 2px;",
        smooth: "transition: box-shadow 180ms ease, opacity 180ms ease;"
      };
      const hoverShadows = settings.hoverLift ? "var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.25))" : "";
      const cardGlowSelector = settings.cardGlowMode === "always" ? ":is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__item" : ":is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane-items .kanban-plugin__item:hover";
      const columnGlowSelector = settings.columnGlowMode === "always" ? ":is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane" : ":is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane:hover";
      const columnColors = [...controller.columnColorTokens.entries()].map(([token, color]) => `
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane-wrapper[data-cs-kanban-column="${token}"] .kanban-plugin__lane {
  background-color: ${rgba(color, settings.columnBlur ? Math.min(settings.columnOpacity / 100, 0.75) : settings.columnOpacity / 100)};
}`).join("\n");
      return `
.kanban-plugin {
  background-color: ${rgba(settings.backgroundOverlay, settings.backgroundOverlayOpacity / 100)};
  background-image: ${image};
  background-size: ${settings.backgroundSize};
  background-position: ${settings.backgroundPosition};
  background-repeat: no-repeat;
}
:is(.kanban-plugin, .kanban-plugin__drag-container) {
  --cs-kanban-card-background: ${rgba(settings.cardBackground, settings.cardOpacity / 100)};
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane-wrapper {
  margin-inline-end: ${settings.columnSpacing}px;
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane {
  background-color: ${rgba(settings.columnBackground, settings.columnBlur ? Math.min(settings.columnOpacity / 100, 0.75) : settings.columnOpacity / 100)};
  border-radius: ${settings.columnRadius}px;
  padding: ${settings.columnPadding}px;
  backdrop-filter: ${settings.columnBlur ? `blur(${settings.columnBlur}px)` : "none"};
  -webkit-backdrop-filter: ${settings.columnBlur ? `blur(${settings.columnBlur}px)` : "none"};
  transition: background-color 180ms ease, box-shadow 180ms ease, outline-color 180ms ease;
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane-items {
  gap: ${settings.cardSpacing}px;
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane-items > div {
  margin-block-start: 0;
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__item,
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__item-content-wrapper,
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__item-title-wrapper {
  background-color: var(--cs-kanban-card-background);
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__item {
  border-radius: ${settings.cardRadius}px;
  padding: ${settings.cardPadding}px;
  transition: box-shadow 180ms ease, opacity 180ms ease, outline-color 180ms ease;
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane-items .kanban-plugin__item:hover {
  ${hoverShadows ? `box-shadow: ${hoverShadows};` : ""}
}
${settings.hoverGlow ? `${cardGlowSelector} { box-shadow: ${cardGlow}; }` : ""}
${settings.columnGlowEnabled ? `${columnGlowSelector} { box-shadow: ${columnGlow}; }` : ""}
.kanban-plugin__drag-container > .kanban-plugin__item-wrapper .kanban-plugin__item {
  ${dragStyles[settings.dragStyle]}
}
:is(.kanban-plugin, .kanban-plugin__drag-container) .is-dropping > .kanban-plugin__lane {
  ${settings.dragStyle === "outline" ? "outline: 2px solid var(--interactive-accent); outline-offset: 2px;" : ""}
  ${settings.dragStyle === "glow" ? "box-shadow: 0 0 18px var(--interactive-accent);" : ""}
}
@media (prefers-reduced-motion: reduce) {
  :is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__item,
  :is(.kanban-plugin, .kanban-plugin__drag-container) .kanban-plugin__lane {
    transition-duration: 0ms !important;
  }
}
${columnColors}`;
    }
    module2.exports = { KanbanController, styles, AUTOMATIC_COLORS };
  }
});

// modules/css-scope.js
var require_css_scope = __commonJS({
  "modules/css-scope.js"(exports2, module2) {
    function findRuleEnd(css, start) {
      let quote = null;
      let parentheses = 0;
      let brackets = 0;
      for (let index = start; index < css.length; index += 1) {
        const character = css[index];
        if (quote) {
          if (character === "\\") index += 1;
          else if (character === quote) quote = null;
          continue;
        }
        if (character === "'" || character === '"') quote = character;
        else if (character === "(") parentheses += 1;
        else if (character === ")") parentheses -= 1;
        else if (character === "[") brackets += 1;
        else if (character === "]") brackets -= 1;
        else if (parentheses === 0 && brackets === 0 && (character === "{" || character === ";")) {
          return { index, delimiter: character };
        }
      }
      return { index: css.length, delimiter: "" };
    }
    function findBlockEnd(css, start) {
      let depth = 1;
      let quote = null;
      for (let index = start; index < css.length; index += 1) {
        const character = css[index];
        if (quote) {
          if (character === "\\") index += 1;
          else if (character === quote) quote = null;
          continue;
        }
        if (character === "'" || character === '"') quote = character;
        else if (character === "{") depth += 1;
        else if (character === "}" && --depth === 0) return index;
      }
      throw new Error("Custom CSS contains an unclosed block.");
    }
    function splitSelectors(prelude) {
      const selectors = [];
      let start = 0;
      let depth = 0;
      let quote = null;
      for (let index = 0; index < prelude.length; index += 1) {
        const character = prelude[index];
        if (quote) {
          if (character === "\\") index += 1;
          else if (character === quote) quote = null;
        } else if (character === "'" || character === '"') quote = character;
        else if (character === "(" || character === "[") depth += 1;
        else if (character === ")" || character === "]") depth -= 1;
        else if (character === "," && depth === 0) {
          selectors.push(prelude.slice(start, index).trim());
          start = index + 1;
        }
      }
      selectors.push(prelude.slice(start).trim());
      return selectors;
    }
    function scopeCss(css, rootSelector) {
      if (!css.trim()) return "";
      function parseRules(source) {
        let output = "";
        let cursor = 0;
        while (cursor < source.length) {
          while (/\s/.test(source[cursor] || "")) cursor += 1;
          if (source.slice(cursor, cursor + 2) === "/*") {
            const end2 = source.indexOf("*/", cursor + 2);
            if (end2 < 0) throw new Error("Custom CSS contains an unclosed comment.");
            output += source.slice(cursor, end2 + 2);
            cursor = end2 + 2;
            continue;
          }
          if (cursor >= source.length) break;
          const rule = findRuleEnd(source, cursor);
          const prelude = source.slice(cursor, rule.index).trim();
          if (!prelude) throw new Error("Custom CSS contains an empty rule.");
          if (rule.delimiter === ";") {
            throw new Error("Custom CSS at-rules such as @import are not allowed in module CSS.");
          }
          if (rule.delimiter !== "{") throw new Error("Custom CSS contains an incomplete rule.");
          const end = findBlockEnd(source, rule.index + 1);
          const body = source.slice(rule.index + 1, end);
          if (prelude.startsWith("@")) {
            if (!/^@(media|supports|container|layer)\b/i.test(prelude)) {
              throw new Error(`Custom CSS at-rule "${prelude.split(/\s/)[0]}" is not supported in module CSS.`);
            }
            output += `${prelude} {${parseRules(body)}}`;
          } else {
            const selectors = splitSelectors(prelude);
            if (selectors.some((selector) => !selector)) {
              throw new Error("Custom CSS contains an empty selector.");
            }
            output += `${selectors.map((selector) => `:where(${rootSelector}) ${selector}`).join(", ")} {${body}}`;
          }
          cursor = end + 1;
        }
        return output;
      }
      return parseRules(css);
    }
    module2.exports = { scopeCss };
  }
});

// modules/kanban/index.js
var require_kanban = __commonJS({
  "modules/kanban/index.js"(exports2, module2) {
    var settings = require_settings();
    var { KanbanController, styles } = require_controller();
    var selectors = require_selectors();
    var { scopeCss } = require_css_scope();
    module2.exports = {
      id: "kanban",
      name: "Kanban",
      target: { type: "community", ids: ["obsidian-kanban"] },
      rootSelector: selectors.root,
      selectors,
      defaultSettings: settings.DEFAULT_SETTINGS,
      settingsSchema: settings.SCHEMA,
      controlGroups: settings.CONTROL_GROUPS,
      validateSettings(value) {
        const validated = settings.validate(value);
        scopeCss(validated.customCss, selectors.root);
        return validated;
      },
      styles,
      customCss: (value) => scopeCss(value.customCss, selectors.root),
      createController: (plugin, manager, module3) => new KanbanController(plugin, manager, module3)
    };
  }
});

// modules/spaced-repetition/settings.js
var require_settings2 = __commonJS({
  "modules/spaced-repetition/settings.js"(exports2, module2) {
    var { createDefaults, validateSettings } = require_settings_utils();
    var SCHEMA = {
      cardBackground: { type: "color", default: "#252a32" },
      cardBorderColor: { type: "color", default: "#454c58" },
      cardRadius: { type: "range", default: 12, min: 0, max: 36 },
      cardShadow: { type: "range", default: 20, min: 0, max: 100 },
      cardPadding: { type: "range", default: 20, min: 0, max: 64 },
      cardSpacing: { type: "range", default: 16, min: 0, max: 48 },
      contentFontSize: { type: "range", default: 100, min: 70, max: 180 },
      contentFontWeight: { type: "select", default: "normal", options: ["normal", "500", "600", "700"] },
      contentColor: { type: "color", default: "#e7e9ed" },
      reviewAreaBackground: { type: "color", default: "#303743" },
      reviewAreaPadding: { type: "range", default: 12, min: 0, max: 40 },
      showAnswerColor: { type: "color", default: "#477db4" },
      againColor: { type: "color", default: "#c94e4e" },
      hardColor: { type: "color", default: "#d87938" },
      goodColor: { type: "color", default: "#3d9b61" },
      easyColor: { type: "color", default: "#397faa" },
      buttonRadius: { type: "range", default: 8, min: 0, max: 32 },
      buttonHeight: { type: "range", default: 48, min: 32, max: 80 },
      buttonGap: { type: "range", default: 8, min: 0, max: 32 },
      transitionDuration: { type: "range", default: 180, min: 0, max: 600 },
      diagnostics: { type: "boolean", default: false },
      customCss: { type: "text", default: "", maxLength: 1e4 }
    };
    var CONTROL_GROUPS = [
      {
        name: "Flashcard",
        controls: [
          { key: "cardBackground", name: "Card background", type: "color" },
          { key: "cardBorderColor", name: "Card border", type: "color" },
          { key: "cardRadius", name: "Corner radius", type: "range", unit: "px" },
          { key: "cardShadow", name: "Shadow strength", type: "range", unit: "%" },
          { key: "cardPadding", name: "Card padding", type: "range", unit: "px" },
          { key: "cardSpacing", name: "Study interface spacing", type: "range", unit: "px" }
        ]
      },
      {
        name: "Card text",
        controls: [
          { key: "contentFontSize", name: "Question and answer size", type: "range", unit: "%" },
          { key: "contentFontWeight", name: "Text weight", type: "select" },
          { key: "contentColor", name: "Text color", type: "color" }
        ]
      },
      {
        name: "Answer and review controls",
        controls: [
          { key: "reviewAreaBackground", name: "Review controls background", type: "color" },
          { key: "reviewAreaPadding", name: "Review controls padding", type: "range", unit: "px" },
          { key: "showAnswerColor", name: "Show answer button", type: "color" },
          { key: "againColor", name: "Again button", type: "color" },
          { key: "hardColor", name: "Hard button", type: "color" },
          { key: "goodColor", name: "Good button", type: "color" },
          { key: "easyColor", name: "Easy button", type: "color" },
          { key: "buttonRadius", name: "Button corner radius", type: "range", unit: "px" },
          { key: "buttonHeight", name: "Button height", type: "range", unit: "px" },
          { key: "buttonGap", name: "Button spacing", type: "range", unit: "px" }
        ]
      },
      {
        name: "Motion",
        controls: [{ key: "transitionDuration", name: "Hover transition", type: "range", unit: "ms" }]
      },
      {
        name: "Diagnostics",
        controls: [{
          key: "diagnostics",
          name: "Enable development diagnostics",
          type: "boolean",
          desc: "Log detection and matched element counts only; flashcard text is never logged."
        }]
      }
    ];
    function validate(value) {
      return validateSettings("Spaced Repetition", value, SCHEMA);
    }
    module2.exports = {
      SCHEMA,
      CONTROL_GROUPS,
      DEFAULT_SETTINGS: createDefaults(SCHEMA),
      validate
    };
  }
});

// modules/spaced-repetition/selectors.js
var require_selectors2 = __commonJS({
  "modules/spaced-repetition/selectors.js"(exports2, module2) {
    module2.exports = {
      root: ".sr-card-container",
      hidden: ".sr-is-hidden",
      content: ".sr-scroll-wrapper .sr-content",
      context: ".sr-context",
      response: ".sr-response",
      button: ".sr-response-button",
      showAnswer: ".sr-show-answer-button",
      again: ".sr-again-button",
      hard: ".sr-hard-button",
      good: ".sr-good-button",
      easy: ".sr-easy-button",
      statusAgain: ".sr-bg-red",
      statusHard: ".sr-bg-yellow",
      statusGood: ".sr-bg-green",
      statusEasy: ".sr-bg-blue"
    };
  }
});

// modules/spaced-repetition/controller.js
var require_controller2 = __commonJS({
  "modules/spaced-repetition/controller.js"(exports2, module2) {
    var { BaseModuleController } = require_base_controller();
    var selectors = require_selectors2();
    function styles(settings) {
      const shadowAlpha = settings.cardShadow / 100;
      const shadows = `0 8px 28px rgba(0, 0, 0, ${shadowAlpha * 0.3}), 0 2px 6px rgba(0, 0, 0, ${shadowAlpha * 0.2})`;
      return `
.sr-card-container {
  --cs-sr-card-background: ${settings.cardBackground};
  --cs-sr-border-color: ${settings.cardBorderColor};
  --cs-sr-again: ${settings.againColor};
  --cs-sr-hard: ${settings.hardColor};
  --cs-sr-good: ${settings.goodColor};
  --cs-sr-easy: ${settings.easyColor};
  --cs-sr-show-answer: ${settings.showAnswerColor};
  --cs-sr-transition: ${settings.transitionDuration}ms;
  box-sizing: border-box;
  background-color: var(--cs-sr-card-background);
  color: ${settings.contentColor};
  border: 1px solid var(--cs-sr-border-color);
  border-radius: ${settings.cardRadius}px;
  box-shadow: ${shadows};
  padding: ${settings.cardPadding}px;
  transition: box-shadow var(--cs-sr-transition) ease, background-color var(--cs-sr-transition) ease;
}
.sr-card-container .sr-scroll-wrapper {
  margin-block-end: ${settings.cardSpacing}px;
}
.sr-card-container .sr-content {
  color: ${settings.contentColor};
  font-size: ${settings.contentFontSize}%;
  font-weight: ${settings.contentFontWeight};
}
.sr-card-container .sr-response {
  gap: ${settings.buttonGap}px;
  padding: ${settings.reviewAreaPadding}px;
  background-color: ${settings.reviewAreaBackground};
  border-radius: ${Math.max(0, settings.cardRadius - 2)}px;
}
.sr-card-container ${selectors.button} {
  min-height: ${settings.buttonHeight}px;
  height: auto;
  line-height: 1.25;
  border-radius: ${settings.buttonRadius}px;
  transition: background-color var(--cs-sr-transition) ease, box-shadow var(--cs-sr-transition) ease;
}
.sr-card-container ${selectors.showAnswer} {
  background-color: var(--cs-sr-show-answer) !important;
}
.sr-card-container ${selectors.again},
.sr-card-container ${selectors.statusAgain} {
  background-color: var(--cs-sr-again) !important;
}
.sr-card-container ${selectors.hard},
.sr-card-container ${selectors.statusHard} {
  background-color: var(--cs-sr-hard) !important;
}
.sr-card-container ${selectors.good},
.sr-card-container ${selectors.statusGood} {
  background-color: var(--cs-sr-good) !important;
}
.sr-card-container ${selectors.easy},
.sr-card-container ${selectors.statusEasy} {
  background-color: var(--cs-sr-easy) !important;
}
.sr-card-container ${selectors.button}:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 3px 12px rgba(0, 0, 0, ${Math.min(shadowAlpha, 0.45)});
}
.sr-card-container ${selectors.button}:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
}
.sr-card-container ${selectors.button}:disabled {
  opacity: 0.6;
}`;
    }
    var SpacedRepetitionController = class extends BaseModuleController {
      refresh(profile) {
        super.refresh(profile);
        if (!this.settings.diagnostics) return;
        const detected = this.manager.isTargetPluginEnabled(this.module);
        let cards = 0;
        let controls = 0;
        let visibleViews = 0;
        for (const root of this.roots.keys()) {
          cards += root.matches?.(selectors.root) ? 1 : 0;
          controls += root.querySelectorAll(selectors.button).length;
          if (!root.matches?.(selectors.hidden)) visibleViews += 1;
        }
        console.info("[Customization Studio] Spaced Repetition diagnostics", {
          detected,
          enabled: profile.moduleEnabled[this.module.id] !== false,
          reviewViewOpen: visibleViews > 0,
          matchedRoots: this.roots.size,
          cards,
          reviewControls: controls,
          stylesInjected: Boolean(this.style?.parentNode)
        });
      }
    };
    module2.exports = { SpacedRepetitionController, styles };
  }
});

// modules/spaced-repetition/index.js
var require_spaced_repetition = __commonJS({
  "modules/spaced-repetition/index.js"(exports2, module2) {
    var settings = require_settings2();
    var { SpacedRepetitionController, styles } = require_controller2();
    var selectors = require_selectors2();
    var { scopeCss } = require_css_scope();
    module2.exports = {
      id: "spaced-repetition",
      name: "Spaced Repetition",
      target: { type: "community", ids: ["obsidian-spaced-repetition"] },
      rootSelector: selectors.root,
      selectors,
      defaultSettings: settings.DEFAULT_SETTINGS,
      settingsSchema: settings.SCHEMA,
      controlGroups: settings.CONTROL_GROUPS,
      validateSettings(value) {
        const validated = settings.validate(value);
        scopeCss(validated.customCss, selectors.root);
        return validated;
      },
      styles,
      customCss: (value) => scopeCss(value.customCss, selectors.root),
      createController: (plugin, manager, module3) => new SpacedRepetitionController(plugin, manager, module3)
    };
  }
});

// modules/bases/settings.js
var require_settings3 = __commonJS({
  "modules/bases/settings.js"(exports2, module2) {
    var { createDefaults, validateSettings } = require_settings_utils();
    var SCHEMA = {
      tableTextSize: { type: "range", default: 14, min: 10, max: 24 },
      tableRowHeight: { type: "range", default: 36, min: 24, max: 80 },
      tableMinColumnWidth: { type: "range", default: 40, min: 24, max: 320 },
      tableMaxColumnWidth: { type: "range", default: 300, min: 80, max: 1200 },
      tableContainerBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
      tableContainerRadius: { type: "range", default: 8, min: 0, max: 32 },
      tableHeaderBackground: { type: "color", default: "#343a46" },
      tableHeaderHover: { type: "color", default: "#414956" },
      tableHeaderColor: { type: "color", default: "#e7e9ed" },
      tableHeaderWeight: { type: "select", default: "600", options: ["normal", "500", "600", "700"] },
      tableHeaderIcons: { type: "boolean", default: true },
      tableBorderColor: { type: "color", default: "#454c58" },
      tableColumnBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
      tableRowBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
      tableRowHover: { type: "color", default: "#363d49" },
      tableActiveCellRadius: { type: "range", default: 4, min: 0, max: 24 },
      tableActiveCellBackground: { type: "color", default: "#303743" },
      tableDisabledCellBackground: { type: "color", default: "#252a32" },
      cardsContainerBackground: { type: "color", default: "#20242b" },
      cardsBackground: { type: "color", default: "#252a32" },
      cardsCoverBackground: { type: "color", default: "#343a46" },
      cardsScale: { type: "range", default: 1, min: 0.6, max: 1.5, step: 0.05 },
      cardsGroupPadding: { type: "range", default: 12, min: 0, max: 48 },
      cardsLineHeight: { type: "range", default: 24, min: 12, max: 48 },
      cardsBorderWidth: { type: "range", default: 1, min: 0, max: 8 },
      cardsShadow: { type: "range", default: 20, min: 0, max: 100 },
      diagnostics: { type: "boolean", default: false },
      customCss: { type: "text", default: "", maxLength: 1e4 }
    };
    var CONTROL_GROUPS = [
      {
        name: "Table view",
        controls: [
          { key: "tableTextSize", name: "Text size", type: "range", unit: "px" },
          { key: "tableRowHeight", name: "Row height", type: "range", unit: "px" },
          { key: "tableMinColumnWidth", name: "Minimum column width", type: "range", unit: "px" },
          { key: "tableMaxColumnWidth", name: "Maximum column width", type: "range", unit: "px" },
          { key: "tableContainerBorderWidth", name: "Container border width", type: "range", unit: "px" },
          { key: "tableContainerRadius", name: "Container corner radius", type: "range", unit: "px" },
          { key: "tableHeaderBackground", name: "Header background", type: "color" },
          { key: "tableHeaderHover", name: "Header hover background", type: "color" },
          { key: "tableHeaderColor", name: "Header text", type: "color" },
          { key: "tableHeaderWeight", name: "Header text weight", type: "select" },
          { key: "tableHeaderIcons", name: "Show header icons", type: "boolean" },
          { key: "tableBorderColor", name: "Table border color", type: "color" },
          { key: "tableColumnBorderWidth", name: "Column border width", type: "range", unit: "px" },
          { key: "tableRowBorderWidth", name: "Row border width", type: "range", unit: "px" },
          { key: "tableRowHover", name: "Row hover background", type: "color" },
          { key: "tableActiveCellRadius", name: "Active cell corner radius", type: "range", unit: "px" },
          { key: "tableActiveCellBackground", name: "Active cell background", type: "color" },
          { key: "tableDisabledCellBackground", name: "Disabled cell background", type: "color" }
        ]
      },
      {
        name: "Cards and gallery",
        controls: [
          { key: "cardsContainerBackground", name: "Gallery background", type: "color" },
          { key: "cardsBackground", name: "Card background", type: "color" },
          { key: "cardsCoverBackground", name: "Cover background", type: "color" },
          { key: "cardsScale", name: "Card scale", type: "range" },
          { key: "cardsGroupPadding", name: "Group spacing", type: "range", unit: "px" },
          { key: "cardsLineHeight", name: "Card text line height", type: "range", unit: "px" },
          { key: "cardsBorderWidth", name: "Card border width", type: "range", unit: "px" },
          { key: "cardsShadow", name: "Card shadow", type: "range", unit: "%" }
        ]
      },
      {
        name: "Diagnostics",
        controls: [{
          key: "diagnostics",
          name: "Enable development diagnostics",
          type: "boolean",
          desc: "Log Bases detection, view counts, and applied CSS variable names only."
        }]
      }
    ];
    function validate(value) {
      const result = validateSettings("Obsidian Bases", value, SCHEMA);
      if (result.tableMinColumnWidth > result.tableMaxColumnWidth) {
        throw new Error("Obsidian Bases minimum column width cannot exceed maximum width.");
      }
      return result;
    }
    module2.exports = {
      SCHEMA,
      CONTROL_GROUPS,
      DEFAULT_SETTINGS: createDefaults(SCHEMA),
      validate
    };
  }
});

// modules/bases/controller.js
var require_controller3 = __commonJS({
  "modules/bases/controller.js"(exports2, module2) {
    var { BaseModuleController } = require_base_controller();
    function styles(settings) {
      const shadowAlpha = settings.cardsShadow / 100;
      const cardShadow = `0 3px 12px rgba(0, 0, 0, ${shadowAlpha * 0.25})`;
      const hoverShadow = `0 8px 24px rgba(0, 0, 0, ${shadowAlpha * 0.4})`;
      return `
.bases-view {
  --bases-table-text-size: ${settings.tableTextSize}px;
  --bases-table-row-height: ${settings.tableRowHeight}px;
  --bases-table-column-min-width: ${settings.tableMinColumnWidth};
  --bases-table-column-max-width: ${settings.tableMaxColumnWidth};
  --bases-table-container-border-width: ${settings.tableContainerBorderWidth}px;
  --bases-table-container-border-radius: ${settings.tableContainerRadius}px;
  --bases-table-header-background: ${settings.tableHeaderBackground};
  --bases-table-header-background-hover: ${settings.tableHeaderHover};
  --bases-table-header-color: ${settings.tableHeaderColor};
  --bases-table-header-weight: ${settings.tableHeaderWeight};
  --bases-table-header-icon-display: ${settings.tableHeaderIcons ? "flex" : "none"};
  --bases-table-border-color: ${settings.tableBorderColor};
  --bases-table-column-border-width: ${settings.tableColumnBorderWidth}px;
  --bases-table-row-border-width: ${settings.tableRowBorderWidth}px;
  --bases-table-row-background-hover: ${settings.tableRowHover};
  --bases-table-cell-radius-active: ${settings.tableActiveCellRadius}px;
  --bases-table-cell-background-active: ${settings.tableActiveCellBackground};
  --bases-table-cell-background-disabled: ${settings.tableDisabledCellBackground};
  --bases-cards-container-background: ${settings.cardsContainerBackground};
  --bases-cards-background: ${settings.cardsBackground};
  --bases-cards-cover-background: ${settings.cardsCoverBackground};
  --bases-cards-scale: ${settings.cardsScale};
  --bases-cards-group-padding: ${settings.cardsGroupPadding}px;
  --bases-cards-line-height: ${settings.cardsLineHeight}px;
  --bases-cards-border-width: ${settings.cardsBorderWidth}px;
  --bases-cards-shadow: ${cardShadow};
  --bases-cards-shadow-hover: ${hoverShadow};
}`;
    }
    var BasesController = class extends BaseModuleController {
      refresh(profile) {
        super.refresh(profile);
        if (!this.settings.diagnostics) return;
        const detected = this.manager.isTargetPluginEnabled(this.module);
        const appliedVariables = this.style?.textContent ? [...this.style.textContent.matchAll(/(--bases-[a-z-]+)\s*:/g)].map((match) => match[1]) : [];
        console.info("[Customization Studio] Bases diagnostics", {
          detected,
          enabled: profile.moduleEnabled[this.module.id] !== false,
          matchedViews: this.roots.size,
          stylesInjected: Boolean(this.style?.parentNode),
          appliedVariables: [...new Set(appliedVariables)]
        });
      }
    };
    module2.exports = { BasesController, styles };
  }
});

// modules/bases/selectors.js
var require_selectors3 = __commonJS({
  "modules/bases/selectors.js"(exports2, module2) {
    module2.exports = {
      root: ".bases-view"
    };
  }
});

// modules/bases/index.js
var require_bases = __commonJS({
  "modules/bases/index.js"(exports2, module2) {
    var settings = require_settings3();
    var { BasesController, styles } = require_controller3();
    var selectors = require_selectors3();
    var { scopeCss } = require_css_scope();
    module2.exports = {
      id: "bases",
      name: "Obsidian Bases",
      target: { type: "core", ids: ["bases"] },
      rootSelector: selectors.root,
      selectors,
      defaultSettings: settings.DEFAULT_SETTINGS,
      settingsSchema: settings.SCHEMA,
      controlGroups: settings.CONTROL_GROUPS,
      validateSettings(value) {
        const validated = settings.validate(value);
        scopeCss(validated.customCss, selectors.root);
        return validated;
      },
      styles,
      customCss: (value) => scopeCss(value.customCss, selectors.root),
      createController: (plugin, manager, module3) => new BasesController(plugin, manager, module3)
    };
  }
});

// modules/create-style-module.js
var require_create_style_module = __commonJS({
  "modules/create-style-module.js"(exports2, module2) {
    var { BaseModuleController } = require_base_controller();
    var { createDefaults, validateSettings } = require_settings_utils();
    var { scopeCss } = require_css_scope();
    function createStyleModule({ id, name, pluginId, root, schema, groups, styles, compatibilityNote }) {
      const settingsSchema = {
        ...schema,
        customCss: { type: "text", default: "", maxLength: 1e4 }
      };
      const module3 = {
        id,
        name,
        defaultEnabled: false,
        target: { type: "community", ids: [pluginId] },
        rootSelector: root,
        selectors: { root },
        compatibilityNote,
        settingsSchema,
        defaultSettings: createDefaults(settingsSchema),
        controlGroups: groups,
        validateSettings(value) {
          const result = validateSettings(name, value, settingsSchema);
          scopeCss(result.customCss, root);
          return result;
        },
        styles,
        customCss: (value) => scopeCss(value.customCss, root),
        createController: (plugin, manager, definition) => new BaseModuleController(plugin, manager, definition)
      };
      return module3;
    }
    function paletteColor(settings, key, themeVariable) {
      return settings.useThemeColors ? `var(${themeVariable})` : settings[key];
    }
    module2.exports = { createStyleModule, paletteColor };
  }
});

// modules/tasks/index.js
var require_tasks = __commonJS({
  "modules/tasks/index.js"(exports2, module2) {
    var { createStyleModule, paletteColor } = require_create_style_module();
    module2.exports = createStyleModule({
      id: "tasks",
      name: "Tasks",
      pluginId: "obsidian-tasks-plugin",
      root: ".plugin-tasks-query-result, .tasks-group-heading, .tasks-modal",
      compatibilityNote: "Source-inspected against Tasks 8.6.0 (which requires Obsidian 1.13.1). Query lists, group headings, metadata chips, and edit-form spacing. Live task editing still needs vault testing.",
      schema: {
        useThemeColors: { type: "boolean", default: true },
        groupColor: { type: "color", default: "#9b8bff" },
        dividerColor: { type: "color", default: "#44444d" },
        chipBackground: { type: "color", default: "#30303a" },
        rowSpacing: { type: "range", default: 4, min: 0, max: 16 },
        textSize: { type: "range", default: 15, min: 11, max: 22 },
        groupSize: { type: "range", default: 16, min: 12, max: 24 },
        groupSpacing: { type: "range", default: 16, min: 4, max: 40 },
        rowDividers: { type: "boolean", default: false },
        metadataChips: { type: "boolean", default: true },
        chipRadius: { type: "range", default: 4, min: 0, max: 16 },
        modalSectionSpacing: { type: "range", default: 10, min: 4, max: 28 }
      },
      groups: [
        { name: "Task query results", controls: [
          { key: "textSize", name: "Task text size", type: "range", unit: "px" },
          { key: "rowSpacing", name: "Task row spacing", type: "range", unit: "px" },
          { key: "rowDividers", name: "Task row dividers", type: "boolean" },
          { key: "groupSize", name: "Task group heading size", type: "range", unit: "px" },
          { key: "groupSpacing", name: "Task group spacing", type: "range", unit: "px" },
          { key: "metadataChips", name: "Date metadata chips", type: "boolean", desc: "Adds a surface behind dates without changing urgency, status colors, or click handlers." },
          { key: "chipRadius", name: "Date chip corner radius", type: "range", unit: "px" }
        ] },
        { name: "Tasks edit form and colors", controls: [
          { key: "modalSectionSpacing", name: "Task edit form section spacing", type: "range", unit: "px" },
          { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use custom colors. Checkbox states, priority, and error indicators are never recolored by this module." },
          { key: "groupColor", name: "Task group heading color", type: "color" },
          { key: "dividerColor", name: "Task divider color", type: "color" },
          { key: "chipBackground", name: "Task date chip background", type: "color" }
        ] }
      ],
      styles(settings) {
        return `.plugin-tasks-query-result { font-size: ${settings.textSize}px; }
    .plugin-tasks-query-result > li {
      padding-block: ${settings.rowSpacing}px;
      ${settings.rowDividers ? `border-bottom: 1px solid ${paletteColor(settings, "dividerColor", "--background-modifier-border")};` : ""}
    }
    .tasks-group-heading {
      color: ${paletteColor(settings, "groupColor", "--text-accent")};
      font-size: ${settings.groupSize}px;
      margin-block-start: ${settings.groupSpacing}px;
      margin-block-end: ${Math.round(settings.groupSpacing / 2)}px;
    }
    ${settings.metadataChips ? `.plugin-tasks-query-result :is(.task-due, .task-scheduled, .task-start, .task-created, .task-done, .task-cancelled) {
      background: ${paletteColor(settings, "chipBackground", "--background-secondary")};
      border-radius: ${settings.chipRadius}px;
      padding-inline: 0.2em;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }` : ""}
    .tasks-modal section + section { margin-top: ${settings.modalSectionSpacing}px; }`;
      }
    });
  }
});

// modules/dataview/index.js
var require_dataview = __commonJS({
  "modules/dataview/index.js"(exports2, module2) {
    var { createStyleModule, paletteColor } = require_create_style_module();
    module2.exports = createStyleModule({
      id: "dataview",
      name: "Dataview",
      pluginId: "dataview",
      root: ".block-language-dataview, .table-view-table, .dataview.inline-field-key, .dataview.inline-field-value, .dataview.inline-field-standalone-value, .dataview-result-list-root-ul",
      compatibilityNote: "Source-inspected against Dataview 0.5.68. Standard tables, lists, and inline fields only; arbitrary DataviewJS markup is not covered. Live vault testing is still required.",
      schema: {
        useThemeColors: { type: "boolean", default: true },
        headerBackground: { type: "color", default: "#30303a" },
        headerText: { type: "color", default: "#eeeeee" },
        stripeBackground: { type: "color", default: "#282832" },
        borderColor: { type: "color", default: "#44444d" },
        fieldBackground: { type: "color", default: "#30303a" },
        fieldText: { type: "color", default: "#dddddd" },
        fontSize: { type: "range", default: 14, min: 11, max: 22 },
        cellPadding: { type: "range", default: 8, min: 2, max: 20 },
        stripedRows: { type: "boolean", default: true },
        rowDividers: { type: "boolean", default: true },
        listSpacing: { type: "range", default: 3, min: 0, max: 14 },
        fieldRadius: { type: "range", default: 4, min: 0, max: 16 }
      },
      groups: [
        { name: "Tables and lists", controls: [
          { key: "fontSize", name: "Dataview table text size", type: "range", unit: "px" },
          { key: "cellPadding", name: "Dataview cell padding", type: "range", unit: "px" },
          { key: "stripedRows", name: "Alternating row backgrounds", type: "boolean" },
          { key: "rowDividers", name: "Show row dividers", type: "boolean" },
          { key: "listSpacing", name: "Dataview list spacing", type: "range", unit: "px" },
          { key: "fieldRadius", name: "Inline field corner radius", type: "range", unit: "px" }
        ] },
        { name: "Dataview colors", controls: [
          { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use the custom colors below. Query output and click behavior are unchanged." },
          { key: "headerBackground", name: "Dataview header background", type: "color" },
          { key: "headerText", name: "Dataview header text", type: "color" },
          { key: "stripeBackground", name: "Dataview alternating background", type: "color" },
          { key: "borderColor", name: "Dataview row border", type: "color" },
          { key: "fieldBackground", name: "Inline field background", type: "color" },
          { key: "fieldText", name: "Inline field text", type: "color" }
        ] }
      ],
      styles(settings) {
        const color = (key, variable) => paletteColor(settings, key, variable);
        return `.table-view-table {
      font-size: ${settings.fontSize}px;
      border-collapse: collapse;
    }
    .table-view-table > thead > tr > th {
      background: ${color("headerBackground", "--background-secondary")};
      color: ${color("headerText", "--text-normal")};
      padding: ${settings.cellPadding}px;
      border-bottom: 1px solid ${color("borderColor", "--background-modifier-border")};
    }
    .table-view-table > tbody > tr > td {
      padding: ${settings.cellPadding}px;
      border-bottom: ${settings.rowDividers ? `1px solid ${color("borderColor", "--background-modifier-border")}` : "0"};
    }
    ${settings.stripedRows ? `.table-view-table > tbody > tr:nth-child(even) {
      background: ${color("stripeBackground", "--background-secondary")};
    }` : ""}
    .table-view-table > tbody > tr:hover { background: var(--background-modifier-hover); }
    .dataview-result-list-root-ul li { margin-block: ${settings.listSpacing}px; }
    .dataview.inline-field-key, .dataview.inline-field-value, .dataview.inline-field-standalone-value {
      background: ${color("fieldBackground", "--background-secondary")};
      color: ${color("fieldText", "--text-normal")};
      border-radius: ${settings.fieldRadius}px;
    }`;
      }
    });
  }
});

// modules/calendar/index.js
var require_calendar = __commonJS({
  "modules/calendar/index.js"(exports2, module2) {
    var { createStyleModule, paletteColor } = require_create_style_module();
    module2.exports = createStyleModule({
      id: "calendar",
      name: "Calendar",
      pluginId: "calendar",
      root: "#calendar-container",
      compatibilityNote: "Source-inspected against Calendar 1.5.10. Uses its documented CSS variables; live vault compatibility still needs testing.",
      schema: {
        useThemeColors: { type: "boolean", default: true },
        textColor: { type: "color", default: "#dddddd" },
        mutedColor: { type: "color", default: "#999999" },
        todayColor: { type: "color", default: "#7c6ce7" },
        dotColor: { type: "color", default: "#7c6ce7" },
        weekendBackground: { type: "color", default: "#282832" },
        highlightWeekends: { type: "boolean", default: true },
        fontSize: { type: "range", default: 14, min: 11, max: 20 },
        padding: { type: "range", default: 8, min: 0, max: 24 },
        radius: { type: "range", default: 8, min: 0, max: 24 }
      },
      groups: [
        { name: "Calendar layout", controls: [
          { key: "fontSize", name: "Calendar text size", type: "range", unit: "px" },
          { key: "padding", name: "Calendar outer padding", type: "range", unit: "px" },
          { key: "radius", name: "Calendar corner radius", type: "range", unit: "px" },
          { key: "highlightWeekends", name: "Highlight weekends", type: "boolean" }
        ] },
        { name: "Calendar colors", controls: [
          { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use the custom colors below. Dates and daily-note behavior are unchanged." },
          { key: "textColor", name: "Calendar day and title text", type: "color" },
          { key: "mutedColor", name: "Calendar headings and navigation", type: "color" },
          { key: "todayColor", name: "Calendar today text", type: "color" },
          { key: "dotColor", name: "Calendar activity dots", type: "color" },
          { key: "weekendBackground", name: "Calendar weekend background", type: "color" }
        ] }
      ],
      styles(settings) {
        const text = paletteColor(settings, "textColor", "--text-normal");
        const muted = paletteColor(settings, "mutedColor", "--text-muted");
        return `#calendar-container {
      --color-text-title: ${text};
      --color-text-day: ${text};
      --color-text-heading: ${muted};
      --color-text-weeknum: ${muted};
      --color-arrow: ${muted};
      --color-button: ${muted};
      --color-text-today: ${paletteColor(settings, "todayColor", "--interactive-accent")};
      --color-dot: ${paletteColor(settings, "dotColor", "--interactive-accent")};
      --color-background-weekend: ${settings.highlightWeekends ? paletteColor(settings, "weekendBackground", "--background-secondary") : "transparent"};
      font-size: ${settings.fontSize}px;
      padding: ${settings.padding}px;
      border-radius: ${settings.radius}px;
    }`;
      }
    });
  }
});

// modules/day-planner/index.js
var require_day_planner = __commonJS({
  "modules/day-planner/index.js"(exports2, module2) {
    var { createStyleModule, paletteColor } = require_create_style_module();
    var ROOT = '[data-type="planner-timeline"], [data-type="planner-weekly"], [data-type="planner-time-tracker"]';
    module2.exports = createStyleModule({
      id: "day-planner",
      name: "Day Planner",
      pluginId: "obsidian-day-planner",
      root: ROOT,
      compatibilityNote: "Source-inspected against Day Planner 0.35.1. Timeline, weekly, and time-tracker appearance only. Time positions, drag handles, per-event colors, and active borders are preserved. Native drag/resize still needs vault testing.",
      schema: {
        useThemeColors: { type: "boolean", default: true },
        timelineBackground: { type: "color", default: "#202027" },
        gridColor: { type: "color", default: "#44444d" },
        textSize: { type: "range", default: 13, min: 10, max: 20 },
        blockRadius: { type: "range", default: 6, min: 0, max: 18 },
        contentSpacing: { type: "range", default: 4, min: 0, max: 12 },
        contentPadding: { type: "range", default: 4, min: 0, max: 12 },
        gridWidth: { type: "range", default: 1, min: 0, max: 3 },
        blockShadow: { type: "range", default: 15, min: 0, max: 50 },
        fontFamily: { type: "select", default: "interface", options: ["interface", "text", "monospace"] }
      },
      groups: [
        { name: "Timeline and time blocks", controls: [
          { key: "textSize", name: "Planner time-block text size", type: "range", unit: "px" },
          { key: "fontFamily", name: "Planner time-block font", type: "select" },
          { key: "blockRadius", name: "Planner time-block corner radius", type: "range", unit: "px" },
          { key: "contentSpacing", name: "Planner content gap", type: "range", unit: "px" },
          { key: "contentPadding", name: "Planner content inner padding", type: "range", unit: "px", desc: "Does not change block position or duration; large values can leave less room in short blocks." },
          { key: "gridWidth", name: "Planner hour separator width", type: "range", unit: "px" },
          { key: "blockShadow", name: "Planner block shadow strength", type: "range", unit: "%" }
        ] },
        { name: "Planner colors", controls: [
          { key: "useThemeColors", name: "Follow theme colors", type: "boolean", desc: "Turn off to use the custom timeline and grid colors. Event colors and state borders remain owned by Day Planner." },
          { key: "timelineBackground", name: "Planner timeline background", type: "color" },
          { key: "gridColor", name: "Planner hour separator color", type: "color" }
        ] }
      ],
      styles(settings) {
        const font = { interface: "--font-interface", text: "--font-text", monospace: "--font-monospace" }[settings.fontFamily];
        return `:is(${ROOT}) {
      --column-background-color: ${paletteColor(settings, "timelineBackground", "--background-primary")};
      --planner-time-block-font-size: ${settings.textSize}px;
      --planner-time-block-font-family: var(${font});
      --time-block-border-radius: ${settings.blockRadius}px;
      --time-block-content-layout-gap: ${settings.contentSpacing}px;
      --time-block-content-layout-padding: ${settings.contentPadding}px;
      --planner-time-block-shadow-on-timeline: 0 2px 6px rgba(0, 0, 0, ${settings.blockShadow / 100});
    }
    :is(${ROOT}) .view-content {
      --border-base: ${settings.gridWidth}px solid ${paletteColor(settings, "gridColor", "--background-modifier-border")};
    }`;
      }
    });
  }
});

// modules/index.js
var require_modules = __commonJS({
  "modules/index.js"(exports2, module2) {
    module2.exports = [
      require_kanban(),
      require_spaced_repetition(),
      require_bases(),
      require_tasks(),
      require_dataview(),
      require_calendar(),
      require_day_planner()
    ];
  }
});

// profiles/minimal.json
var require_minimal = __commonJS({
  "profiles/minimal.json"(exports2, module2) {
    module2.exports = {
      id: "minimal",
      name: "Minimal",
      description: "A restrained accent and compact visual treatment.",
      variables: {
        accentColor: "#7c6ce7"
      },
      customCss: "",
      moduleCss: {}
    };
  }
});

// profiles/dark-academia.json
var require_dark_academia = __commonJS({
  "profiles/dark-academia.json"(exports2, module2) {
    module2.exports = {
      id: "dark-academia",
      name: "Dark Academia",
      description: "Warm parchment accents for a quiet reading workspace.",
      variables: {
        accentColor: "#b18a58",
        surfaceColor: "#29231e",
        textColor: "#e6dac5"
      },
      customCss: "",
      moduleCss: {}
    };
  }
});

// profiles/glassmorphism.json
var require_glassmorphism = __commonJS({
  "profiles/glassmorphism.json"(exports2, module2) {
    module2.exports = {
      id: "glassmorphism",
      name: "Glassmorphism",
      description: "Cool accents and soft rounded surfaces; translucency can be added with custom CSS.",
      variables: {
        accentColor: "#71b7d5",
        surfaceColor: "#202c35",
        textColor: "#e1edf2"
      },
      customCss: "",
      moduleCss: {}
    };
  }
});

// profiles/colorful.json
var require_colorful = __commonJS({
  "profiles/colorful.json"(exports2, module2) {
    module2.exports = {
      id: "colorful",
      name: "Colorful",
      description: "A vivid accent color with rounded interface elements.",
      variables: {
        accentColor: "#e35d9b"
      },
      customCss: "",
      moduleCss: {}
    };
  }
});

// profiles/focus-mode.json
var require_focus_mode = __commonJS({
  "profiles/focus-mode.json"(exports2, module2) {
    module2.exports = {
      id: "focus-mode",
      name: "Focus Mode",
      description: "A low-distraction neutral palette and compact corners.",
      variables: {
        accentColor: "#858f99",
        surfaceColor: "#202326",
        textColor: "#d2d5d8"
      },
      customCss: "",
      moduleCss: {}
    };
  }
});

// core/profile-manager.js
var require_profile_manager = __commonJS({
  "core/profile-manager.js"(exports2, module2) {
    var MODULES = require_modules();
    var BUILT_IN_PROFILES = [
      require_minimal(),
      require_dark_academia(),
      require_glassmorphism(),
      require_colorful(),
      require_focus_mode()
    ];
    var PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
    var COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
    var PROFILE_VARIABLE_DEFAULTS = {
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
    var TAB_BAR_GRADIENT_TYPES = /* @__PURE__ */ new Set(["linear", "radial", "circle"]);
    var TAB_BAR_GRADIENT_POSITIONS = /* @__PURE__ */ new Set([
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "top left",
      "top right",
      "bottom left",
      "bottom right"
    ]);
    var TAB_BAR_GRADIENT_DIRECTIONS = /* @__PURE__ */ new Set([
      "to right",
      "to left",
      "to bottom",
      "to top",
      "to bottom right",
      "to bottom left",
      "to top right",
      "to top left"
    ]);
    function validateProfile(profile, knownModules, legacyModuleEnabled = {}) {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        throw new Error("A profile must be a JSON object.");
      }
      if (typeof profile.id !== "string" || !PROFILE_ID_PATTERN.test(profile.id)) {
        throw new Error("Profile id must contain lowercase letters, numbers, and hyphens.");
      }
      const allowedFields = /* @__PURE__ */ new Set([
        "id",
        "name",
        "description",
        "variables",
        "customCss",
        "moduleEnabled",
        "modules",
        "moduleCss",
        "inactiveModuleCss"
      ]);
      for (const key of Object.keys(profile)) {
        if (!allowedFields.has(key)) {
          throw new Error(`Profile "${profile.id}" contains unsupported field "${key}".`);
        }
      }
      if (typeof profile.name !== "string" || profile.name.trim().length === 0 || profile.name.length > 100) {
        throw new Error(`Profile "${profile.id}" must have a name.`);
      }
      if (typeof profile.description !== "string" || profile.description.length > 2e3) {
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
      if (typeof profile.customCss !== "string" || profile.customCss.length > 3e4) {
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
      for (const module3 of MODULES) {
        const saved = moduleSettings[module3.id] ?? {};
        if (typeof saved !== "object" || saved === null || Array.isArray(saved)) {
          throw new Error(`Profile "${profile.id}" modules.${module3.id} must be an object.`);
        }
        const migratedCss = oldModuleCss[module3.id];
        if (migratedCss !== void 0 && typeof migratedCss !== "string") {
          throw new Error(`Profile "${profile.id}" moduleCss.${module3.id} must be a string.`);
        }
        modules[module3.id] = module3.validateSettings({
          ...saved,
          ...saved.customCss === void 0 && migratedCss !== void 0 ? { customCss: migratedCss } : {}
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
        if (typeof css !== "string" || css.length > 1e4) {
          throw new Error(`Profile "${profile.id}" inactiveModuleCss.${moduleId} must be a string.`);
        }
      }
      const compatibleLegacyEnabled = Object.fromEntries(
        Object.entries(legacyModuleEnabled).filter(([moduleId]) => knownModules.has(moduleId))
      );
      const moduleEnabled = { ...compatibleLegacyEnabled, ...profile.moduleEnabled || {} };
      for (const [moduleId, enabled] of Object.entries(moduleEnabled)) {
        if (!knownModules.has(moduleId) || typeof enabled !== "boolean") {
          throw new Error(`Profile "${profile.id}" has an invalid moduleEnabled.${moduleId} value.`);
        }
      }
      for (const module3 of MODULES) {
        if (moduleEnabled[module3.id] === void 0) moduleEnabled[module3.id] = module3.defaultEnabled !== false;
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
    var ProfileManager2 = class {
      constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this.modules = MODULES;
        this.knownModules = new Set(MODULES.map((module3) => module3.id));
        const legacyEnabled = settingsManager.settings.moduleEnabled || {};
        this.builtInProfiles = BUILT_IN_PROFILES.map(
          (profile) => validateProfile(profile, this.knownModules, legacyEnabled)
        );
        this.customProfiles = [];
      }
      load() {
        this.customProfiles = this.settingsManager.settings.customProfiles.map(
          (profile) => validateProfile(profile, this.knownModules, this.settingsManager.settings.moduleEnabled)
        );
        const ids = /* @__PURE__ */ new Set();
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
        const modules = Object.fromEntries(this.modules.map((module3) => [
          module3.id,
          { ...active.modules[module3.id], ...moduleUpdates[module3.id] || {} }
        ]));
        const updated = validateProfile({
          ...active,
          ...profileUpdate,
          variables: replaceVariables ? update.variables : { ...active.variables, ...update.variables || {} },
          moduleEnabled: { ...active.moduleEnabled, ...update.moduleEnabled || {} },
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
    };
    module2.exports = { ProfileManager: ProfileManager2, validateProfile, PROFILE_VARIABLE_DEFAULTS };
  }
});

// core/theme-engine.js
var require_theme_engine = __commonJS({
  "core/theme-engine.js"(exports2, module2) {
    var { normalizePath } = require("obsidian");
    var VARIABLE_MAP = {
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
    var ThemeEngine2 = class _ThemeEngine {
      constructor(plugin, body = null) {
        this.plugin = plugin;
        this.styles = /* @__PURE__ */ new Map();
        this.body = body || plugin.app.workspace.containerEl.ownerDocument.body;
        this.isSecondaryDocument = Boolean(body);
        this.documentEngines = /* @__PURE__ */ new Map();
        this.previousClassState = null;
        this.previousProfile = null;
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
        if (!this.isSecondaryDocument) {
          const documents = this.plugin.moduleManager?.getDocuments?.() || /* @__PURE__ */ new Set([this.body.ownerDocument]);
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
              engine = new _ThemeEngine(this.plugin, doc.body);
              const coreCss = this.styles.get("core")?.textContent;
              if (coreCss) engine.setStyle("core", coreCss);
              this.documentEngines.set(doc, engine);
            }
            engine.apply(profile);
          }
        }
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
          `body.customization-studio-enabled[data-customization-studio-profile="${profile.id}"] {
  ${declarations.join("\n  ")}
}
body.customization-studio-enabled[data-customization-studio-profile="${profile.id}"] .workspace-tab-header-container {
  background-color: ${profile.variables.tabBarOpacity === 0 ? "transparent" : colorWithOpacity(profile.variables.surfaceColor, profile.variables.tabBarOpacity / 100)};
  background-image: ${tabBarGradient(profile.variables)};
  backdrop-filter: blur(${profile.variables.tabBarBlur}px);
  -webkit-backdrop-filter: blur(${profile.variables.tabBarBlur}px);
}`
        );
        this.setStyle("profile", profile.customCss || "");
      }
      unload() {
        for (const engine of this.documentEngines.values()) engine.unload();
        this.documentEngines.clear();
        if (this.previousClassState === false) {
          this.body.classList.remove("customization-studio-enabled");
        }
        if (this.previousProfile === void 0) {
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
    };
    module2.exports = { ThemeEngine: ThemeEngine2, VARIABLE_MAP, colorWithOpacity, tabBarGradient };
  }
});

// core/plugin-discovery.js
var require_plugin_discovery = __commonJS({
  "core/plugin-discovery.js"(exports2, module2) {
    function isTargetEnabled(app, target) {
      for (const id of target.ids) {
        try {
          if (target.type === "core") {
            const registry = app?.internalPlugins;
            if (!registry) continue;
            if (registry.getEnabledPluginById?.(id)) return true;
            const entry = typeof registry.getPluginById === "function" ? registry.getPluginById(id) : registry.plugins?.[id];
            if (entry?.enabled === true) return true;
          } else {
            const registry = app?.plugins;
            if (!registry) continue;
            if (registry.enabledPlugins?.has?.(id)) return true;
            if (typeof registry.getPlugin === "function" && registry.getPlugin(id)) return true;
          }
        } catch {
        }
      }
      return false;
    }
    module2.exports = { isTargetEnabled };
  }
});

// core/module-manager.js
var require_module_manager = __commonJS({
  "core/module-manager.js"(exports2, module2) {
    var MODULES = require_modules();
    var { isTargetEnabled } = require_plugin_discovery();
    var ModuleManager2 = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.modules = MODULES;
        this.controllers = /* @__PURE__ */ new Map();
        this.documents = /* @__PURE__ */ new Map();
        this.windowDocuments = /* @__PURE__ */ new Set();
        this.closedDocuments = /* @__PURE__ */ new WeakSet();
        this.pendingRefresh = null;
      }
      getDocuments() {
        const workspace = this.plugin.app.workspace;
        const documents = /* @__PURE__ */ new Set([workspace.containerEl.ownerDocument]);
        workspace.iterateAllLeaves?.((leaf) => {
          const doc = leaf.view?.containerEl?.ownerDocument;
          if (doc && !this.closedDocuments.has(doc)) documents.add(doc);
        });
        for (const doc of this.windowDocuments) documents.add(doc);
        return documents;
      }
      load() {
        for (const module3 of this.modules) {
          const controller = module3.createController(this.plugin, this, module3);
          this.controllers.set(module3.id, controller);
          controller.start();
        }
        const workspace = this.plugin.app.workspace;
        this.plugin.registerEvent(workspace.on("layout-change", () => this.refreshWithNotice()));
        this.plugin.registerEvent(workspace.on("window-open", (win) => {
          this.closedDocuments.delete(win.doc);
          this.windowDocuments.add(win.doc);
          this.refreshWithNotice();
        }));
        this.plugin.registerEvent(workspace.on("window-close", (win) => {
          this.closedDocuments.add(win.doc);
          this.windowDocuments.delete(win.doc);
          this.refreshWithNotice();
        }));
        this.watchDocuments();
        this.plugin.register(() => this.unload());
      }
      watchDocuments() {
        const documents = this.getDocuments();
        for (const [doc, observer] of this.documents) {
          if (!documents.has(doc)) {
            observer?.disconnect();
            this.documents.delete(doc);
          }
        }
        const selector = this.modules.map((module3) => module3.rootSelector).join(", ");
        for (const doc of documents) {
          if (this.documents.has(doc)) continue;
          const Observer = doc.defaultView?.MutationObserver || globalThis.MutationObserver;
          const observer = Observer && doc.body ? new Observer((records) => {
            const relevant = records.some(
              (record) => [...record.addedNodes, ...record.removedNodes].some(
                (node) => node.nodeType === 1 && (node.matches?.(selector) || node.querySelector?.(selector))
              )
            );
            if (!relevant || this.pendingRefresh !== null) return;
            this.pendingRefresh = setTimeout(() => {
              this.pendingRefresh = null;
              this.refreshWithNotice();
            }, 40);
          }) : null;
          observer?.observe(doc.body, { childList: true, subtree: true });
          this.documents.set(doc, observer);
        }
      }
      isEnabled(moduleId) {
        const profile = this.plugin.profileManager.getActiveProfile();
        return profile.moduleEnabled[moduleId] !== false;
      }
      setEnabled(moduleId, enabled) {
        if (!this.controllers.has(moduleId)) {
          throw new Error(`Unknown customization module "${moduleId}".`);
        }
        this.plugin.profileManager.setModuleEnabled(moduleId, enabled);
      }
      isTargetPluginEnabled(module3) {
        return isTargetEnabled(this.plugin.app, module3.target);
      }
      getDetectedColumns(moduleId) {
        const controller = this.controllers.get(moduleId);
        return controller?.getColumnNames?.() || [];
      }
      refresh(profile = this.plugin.profileManager.getActiveProfile()) {
        this.watchDocuments();
        for (const controller of this.controllers.values()) controller.refresh(profile);
      }
      refreshWithNotice() {
        try {
          const profile = this.plugin.profileManager.getActiveProfile();
          this.plugin.themeEngine?.apply(profile);
          this.refresh(profile);
        } catch (error) {
          console.error("Customization Studio failed to update module styles after a workspace change.", error);
          this.plugin.notifyUser(`Customization Studio could not update a module: ${error.message}`);
        }
      }
      unload() {
        if (this.pendingRefresh !== null) clearTimeout(this.pendingRefresh);
        this.pendingRefresh = null;
        for (const observer of this.documents.values()) observer?.disconnect();
        this.documents.clear();
        this.windowDocuments.clear();
        for (const controller of this.controllers.values()) controller.unload();
        this.controllers.clear();
      }
    };
    module2.exports = { MODULES, ModuleManager: ModuleManager2 };
  }
});

// core/settings-tab.js
var require_settings_tab = __commonJS({
  "core/settings-tab.js"(exports2, module2) {
    var { PluginSettingTab, Setting, Notice: Notice2 } = require("obsidian");
    var { MODULES } = require_module_manager();
    var CustomizationSettingTab2 = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.importText = "";
        this.newProfileName = "";
        this.renameValue = "";
        this.viewContexts = /* @__PURE__ */ new WeakMap();
        this.openViews = /* @__PURE__ */ new Set();
        this.viewSaveTimers = /* @__PURE__ */ new Set();
      }
      display() {
        this.displayInto(this.containerEl, "settingsTab");
      }
      displayInto(containerEl, viewKey = "settingsTab") {
        let context = this.viewContexts.get(containerEl);
        if (!context) {
          const saved = this.plugin.settingsManager.settings.uiState[viewKey];
          context = {
            containerEl,
            viewKey,
            section: saved.section,
            moduleId: saved.moduleId,
            scrollTop: saved.scrollTop,
            preview: null,
            saveTimer: null,
            scrollHandler: null
          };
          context.scrollHandler = () => {
            context.scrollTop = containerEl.scrollTop;
            this.plugin.settingsManager.settings.uiState[viewKey] = {
              section: context.section,
              moduleId: context.moduleId,
              scrollTop: context.scrollTop
            };
            this.scheduleViewStateSave(context);
          };
          containerEl.addEventListener("scroll", context.scrollHandler, { passive: true });
          this.viewContexts.set(containerEl, context);
          this.openViews.add(context);
        }
        for (const observer of context.tabResizeObservers || []) observer.disconnect();
        context.tabResizeObservers = [];
        containerEl.empty();
        containerEl.addClass("customization-studio-settings");
        const header = containerEl.createEl("header", { cls: "cs-settings-header" });
        header.createEl("p", {
          text: "Visual profiles for Obsidian and supported plugins. Settings preview immediately and save automatically."
        });
        const activeProfile = this.plugin.profileManager.getActiveProfile();
        const profileHeader = header.createEl("div", {
          cls: "cs-active-profile-header",
          attr: { "aria-label": `Active profile: ${activeProfile.name}`, "aria-live": "polite" }
        });
        profileHeader.createEl("span", { cls: "cs-active-profile-badge", text: "Active profile" });
        const profileName = profileHeader.createEl("strong", { text: activeProfile.name });
        const swatches = profileHeader.createEl("div", {
          cls: "cs-profile-swatches",
          attr: { "aria-label": "Active profile color preview" }
        });
        for (const [label, value] of [
          ["Accent", activeProfile.variables.accentColor],
          ["Surface", activeProfile.variables.surfaceColor],
          ["Text", activeProfile.variables.textColor],
          ["Tab gradient", activeProfile.variables.tabBarGradientColor]
        ]) {
          const swatch = swatches.createEl("span", { cls: "cs-profile-swatch" });
          swatch.dataset.profileColor = label;
          swatch.setAttribute("title", `${label}: ${value}`);
          swatch.setAttribute("aria-label", `${label}: ${value}`);
          swatch.style.backgroundColor = value;
        }
        const enabledModules = MODULES.filter((module3) => activeProfile.moduleEnabled[module3.id] !== false).map((module3) => module3.name);
        const moduleSummary = profileHeader.createEl("span", {
          cls: "cs-profile-modules",
          text: enabledModules.length ? `Enabled: ${enabledModules.join(", ")}` : "No modules enabled"
        });
        context.preview = { name: profileName, swatches: [...swatches.children], moduleSummary };
        const navigation = containerEl.createEl("div", {
          cls: "cs-primary-tabs",
          attr: { role: "tablist", "aria-label": "Customization Studio settings" }
        });
        const panel = containerEl.createEl("section", {
          cls: "cs-primary-panel",
          attr: {
            role: "tabpanel",
            tabindex: "0",
            id: `cs-${context.viewKey}-panel`,
            "aria-labelledby": `cs-${context.viewKey}-tab-${context.section}`
          }
        });
        context.panel = panel;
        const tabs = [
          ["global", "Global appearance"],
          ["profiles", "Profiles"],
          ["integrations", "Integrations"]
        ];
        const tabElements = [];
        for (const [id, label] of tabs) {
          const tab = navigation.createEl("button", {
            text: label,
            attr: {
              type: "button",
              role: "tab",
              "aria-selected": String(context.section === id),
              tabindex: context.section === id ? "0" : "-1",
              "aria-controls": `cs-${context.viewKey}-panel`
            }
          });
          tabElements.push(tab);
          tab.setAttribute("id", `cs-${context.viewKey}-tab-${id}`);
          if (context.section === id) tab.addClass("is-active");
          tab.addEventListener("click", () => {
            context.focusPrimaryTab = tabs.findIndex(([tabId]) => tabId === id);
            this.setViewState(context, { section: id });
            this.refreshDisplay(context);
          });
          tab.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const index = tabs.findIndex(([tabId]) => tabId === id);
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            context.focusPrimaryTab = nextIndex;
            this.setViewState(context, { section: tabs[nextIndex][0] });
            this.refreshDisplay(context);
          });
        }
        this.decorateTabs(navigation, tabElements, context, "primary");
        if (context.focusPrimaryTab !== void 0) {
          tabElements[context.focusPrimaryTab]?.focus();
          delete context.focusPrimaryTab;
        }
        if (context.section === "global") {
          panel.setAttribute("aria-label", "Global appearance");
          this.displayGlobalSettings(panel, context);
        } else if (context.section === "profiles") {
          panel.setAttribute("aria-label", "Profiles");
          this.displayProfileSettings(panel, context);
        } else {
          panel.setAttribute("aria-label", "Integrations");
          this.displayModules(panel, context);
        }
        const footer = containerEl.createEl("footer", { cls: "cs-settings-footer" });
        footer.createEl("p", {
          text: "Support via plugin details."
        });
        containerEl.scrollTop = context.scrollTop;
      }
      decorateTabs(navigation, tabs, context, key) {
        const active = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
        if (!active?.getBoundingClientRect) return;
        const doc = navigation.ownerDocument;
        const selected = active.id;
        const previous = context.tabIndicators?.[key];
        const indicator = navigation.createEl("span", {
          cls: "cs-tab-indicator",
          attr: { "aria-hidden": "true" }
        });
        navigation.addClass("cs-animated-tabs");
        const position = { left: active.offsetLeft, width: active.offsetWidth, selected };
        indicator.style.left = `${position.left}px`;
        indicator.style.width = `${position.width}px`;
        const reducedMotion = doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (previous && previous.selected !== selected && !reducedMotion) {
          indicator.animate?.([
            { left: `${previous.left}px`, width: `${previous.width}px` },
            { left: `${position.left}px`, width: `${position.width}px` }
          ], { duration: 220, easing: "ease-out" });
          const panel = key === "primary" ? context.panel : navigation.nextElementSibling;
          panel?.animate?.([
            { opacity: 0, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" }
          ], { duration: 180, easing: "ease-out" });
        }
        context.tabIndicators || (context.tabIndicators = {});
        context.tabIndicators[key] = position;
        const end = position.left + position.width;
        const Observer = doc.defaultView?.ResizeObserver;
        if (Observer) {
          const observer = new Observer(() => {
            const next = { left: active.offsetLeft, width: active.offsetWidth, selected };
            indicator.style.left = `${next.left}px`;
            indicator.style.width = `${next.width}px`;
            context.tabIndicators[key] = next;
            if (next.left < navigation.scrollLeft) navigation.scrollLeft = next.left;
            else if (next.left + next.width > navigation.scrollLeft + navigation.clientWidth) {
              navigation.scrollLeft = next.left + next.width - navigation.clientWidth;
            }
          });
          observer.observe(navigation);
          observer.observe(active);
          (context.tabResizeObservers || (context.tabResizeObservers = [])).push(observer);
        }
        if (position.left < navigation.scrollLeft) navigation.scrollLeft = position.left;
        else if (end > navigation.scrollLeft + navigation.clientWidth) navigation.scrollLeft = end - navigation.clientWidth;
      }
      releaseDisplayTarget(containerEl) {
        const context = this.viewContexts.get(containerEl);
        if (!context) return;
        context.scrollTop = containerEl.scrollTop;
        containerEl.removeEventListener("scroll", context.scrollHandler);
        if (context.saveTimer) {
          clearTimeout(context.saveTimer);
          this.viewSaveTimers.delete(context.saveTimer);
          context.saveTimer = null;
        }
        this.persistViewState(context);
        for (const observer of context.tabResizeObservers || []) observer.disconnect();
        this.viewContexts.delete(containerEl);
        this.openViews.delete(context);
      }
      dispose() {
        this.captureViewState();
        for (const context of this.openViews) {
          context.containerEl.removeEventListener("scroll", context.scrollHandler);
          for (const observer of context.tabResizeObservers || []) observer.disconnect();
          if (context.saveTimer) clearTimeout(context.saveTimer);
        }
        this.openViews.clear();
        for (const timer of this.viewSaveTimers) clearTimeout(timer);
        this.viewSaveTimers.clear();
      }
      captureViewState() {
        let pending = false;
        for (const context of this.openViews) {
          const state = {
            section: context.section,
            moduleId: context.moduleId,
            scrollTop: context.containerEl.scrollTop
          };
          context.scrollTop = state.scrollTop;
          const previous = this.plugin.settingsManager.settings.uiState[context.viewKey];
          if (JSON.stringify(previous) !== JSON.stringify(state) || context.saveTimer) pending = true;
          this.plugin.settingsManager.settings.uiState[context.viewKey] = state;
        }
        return pending;
      }
      refreshDisplay(context) {
        if (context) this.displayInto(context.containerEl, context.viewKey);
      }
      refreshAllViews() {
        for (const context of this.openViews) this.refreshDisplay(context);
      }
      refreshOtherViews(currentContext) {
        for (const context of this.openViews) {
          if (context !== currentContext) this.refreshDisplay(context);
        }
      }
      setViewState(context, update) {
        Object.assign(context, update);
        this.plugin.settingsManager.settings.uiState[context.viewKey] = {
          section: context.section,
          moduleId: context.moduleId,
          scrollTop: context.scrollTop
        };
        this.scheduleViewStateSave(context);
      }
      scheduleViewStateSave(context) {
        if (context.saveTimer) {
          clearTimeout(context.saveTimer);
          this.viewSaveTimers.delete(context.saveTimer);
        }
        const timer = setTimeout(() => {
          this.viewSaveTimers.delete(timer);
          context.saveTimer = null;
          this.runChange(() => this.plugin.settingsManager.scheduleSave());
        }, 500);
        context.saveTimer = timer;
        this.viewSaveTimers.add(timer);
      }
      persistViewState(context) {
        this.plugin.settingsManager.settings.uiState[context.viewKey] = {
          section: context.section,
          moduleId: context.moduleId,
          scrollTop: context.scrollTop
        };
        this.runChange(() => this.plugin.settingsManager.scheduleSave());
      }
      displayProfileSettings(containerEl, context) {
        const active = this.plugin.profileManager.getActiveProfile();
        const isCustom = this.plugin.profileManager.customProfiles.some((profile) => profile.id === active.id);
        const section = containerEl.createEl("div", { cls: "cs-section" });
        new Setting(section).setName("Profiles").setHeading();
        section.createEl("p", {
          text: `Editing profiles. The active profile is "${active.name}".`
        });
        section.createEl("p", {
          cls: "cs-suggestions-unavailable",
          text: "Suggested profiles are unavailable: this version does not define recommendation rules or verified theme-detection behavior."
        });
        new Setting(section).setName("Active profile").setDesc(`Currently active: ${active.name}. Switching applies the profile immediately.`).addDropdown((dropdown) => {
          for (const profile of this.plugin.profileManager.getProfiles()) {
            dropdown.addOption(profile.id, profile.name);
          }
          dropdown.setValue(active.id).onChange((id) => this.runChange(async () => {
            this.plugin.profileManager.setActiveProfile(id);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
            new Notice2(`Customization Studio: applied "${this.plugin.profileManager.getActiveProfile().name}".`);
          }));
        });
        new Setting(section).setName("New profile").setDesc("Create a profile by copying the active profile.").addText((text) => {
          text.setPlaceholder("Profile name").setValue(this.newProfileName);
          text.inputEl.maxLength = 100;
          text.onChange((value) => {
            this.newProfileName = value;
          });
        }).addButton((button) => button.setButtonText("Create").setCta().onClick(() => this.runChange(async () => {
          this.plugin.profileManager.createCustomProfile(this.newProfileName);
          this.newProfileName = "";
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
        })));
        if (isCustom) {
          new Setting(section).setName("Duplicate profile").setDesc("Create an independent copy of the active profile.").addButton((button) => button.setButtonText("Duplicate").onClick(() => this.runChange(async () => {
            this.plugin.profileManager.duplicateProfile(active.id);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
          new Setting(section).setName("Rename profile").addText((text) => {
            text.inputEl.maxLength = 100;
            text.setPlaceholder(active.name).setValue(this.renameValue || active.name).onChange((value) => {
              this.renameValue = value;
            });
          }).addButton((button) => button.setButtonText("Rename").onClick(() => this.runChange(async () => {
            this.plugin.profileManager.renameCustomProfile(active.id, this.renameValue);
            this.renameValue = "";
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
        } else {
          new Setting(section).setName("Customize built-in profile").setDesc("Make an editable copy before changing its appearance or module settings.").addButton((button) => button.setButtonText("Duplicate").setCta().onClick(() => this.runChange(async () => {
            this.plugin.profileManager.createCustomProfile(`${active.name} custom`);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
        }
        new Setting(section).setName("Export profile").setDesc("Copy the active profile as JSON, including all module settings.").addButton((button) => button.setButtonText("Copy JSON").onClick(() => this.runChange(async () => {
          if (!globalThis.navigator?.clipboard?.writeText) {
            throw new Error("Clipboard access is unavailable in this Obsidian environment.");
          }
          await globalThis.navigator.clipboard.writeText(
            this.plugin.profileManager.exportProfile(active.id)
          );
          new Notice2("Customization Studio: profile JSON copied.");
        })));
        new Setting(section).setName("Import profile").setDesc("Paste profile JSON. Imported IDs are made unique automatically.").addTextArea((text) => {
          text.setPlaceholder("Paste exported profile JSON").setValue(this.importText);
          text.inputEl.addClass("cs-code-input");
          text.onChange((value) => {
            this.importText = value;
          });
        }).addButton((button) => button.setButtonText("Import").onClick(() => this.runChange(async () => {
          if (!this.importText.trim()) throw new Error("Paste profile JSON before importing.");
          const imported = this.plugin.profileManager.importProfile(this.importText);
          this.importText = "";
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
          new Notice2(`Customization Studio: imported "${imported.name}".`);
        })));
        if (isCustom) {
          new Setting(section).setName("Delete profile").setDesc("Switches to Minimal if this is the active profile.").addButton((button) => button.setButtonText("Delete").setWarning().onClick(() => this.runChange(async () => {
            this.plugin.profileManager.deleteCustomProfile(active.id);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
        }
      }
      displayGlobalSettings(containerEl, context) {
        const profile = this.plugin.profileManager.getActiveProfile();
        const section = containerEl.createEl("div", { cls: "cs-section" });
        if (!this.isCustom(profile)) {
          section.createEl("p", { text: "Duplicate the active built-in profile to edit its settings." });
          return;
        }
        this.addColorControl(
          section,
          "Accent color",
          profile.variables.accentColor,
          (value) => this.updateProfile({ variables: { accentColor: value } }, context)
        );
        this.addColorControl(
          section,
          "Surface color",
          profile.variables.surfaceColor,
          (value) => this.updateProfile({ variables: { surfaceColor: value } }, context)
        );
        this.addColorControl(
          section,
          "Text color",
          profile.variables.textColor,
          (value) => this.updateProfile({ variables: { textColor: value } }, context)
        );
        new Setting(section).setName("Tab bar background opacity").setDesc("Affects the tab header container background only; labels and icons stay fully opaque.").addSlider((slider) => slider.setLimits(0, 100, 1).setValue(profile.variables.tabBarOpacity).setDynamicTooltip().onChange((value) => this.updateProfile({ variables: { tabBarOpacity: value } }, context)));
        new Setting(section).setName("Tab bar backdrop blur").setDesc("Uses backdrop-filter where supported. Blur shows through translucent backgrounds; zero disables it.").addSlider((slider) => slider.setLimits(0, 24, 1).setValue(profile.variables.tabBarBlur).setDynamicTooltip().onChange((value) => this.updateProfile({ variables: { tabBarBlur: value } }, context)));
        this.addColorControl(
          section,
          "Tab bar gradient color",
          profile.variables.tabBarGradientColor,
          (value) => this.updateProfile({ variables: { tabBarGradientColor: value } }, context)
        );
        new Setting(section).setName("Tab bar gradient type").setDesc("Choose linear, elliptical radial, or circular radial gradient.").addDropdown((dropdown) => {
          dropdown.addOption("linear", "Linear");
          dropdown.addOption("radial", "Radial");
          dropdown.addOption("circle", "Circular radial");
          dropdown.setValue(profile.variables.tabBarGradientType).onChange((value) => this.updateProfile({ variables: { tabBarGradientType: value } }, context));
        });
        new Setting(section).setName("Tab bar gradient direction").setDesc("Direction is used by linear gradients.").addDropdown((dropdown) => {
          for (const direction of [
            "to right",
            "to left",
            "to bottom",
            "to top",
            "to bottom right",
            "to bottom left",
            "to top right",
            "to top left"
          ]) dropdown.addOption(direction, direction);
          dropdown.setValue(profile.variables.tabBarGradientDirection).onChange((value) => this.updateProfile({
            variables: { tabBarGradientDirection: value }
          }, context));
        });
        new Setting(section).setName("Tab bar radial gradient position").setDesc("Position is used by radial and circular radial gradients.").addDropdown((dropdown) => {
          for (const position of [
            "center",
            "top",
            "bottom",
            "left",
            "right",
            "top left",
            "top right",
            "bottom left",
            "bottom right"
          ]) dropdown.addOption(position, position);
          dropdown.setValue(profile.variables.tabBarGradientPosition).onChange((value) => this.updateProfile({
            variables: { tabBarGradientPosition: value }
          }, context));
        });
        new Setting(section).setName("Tab bar gradient intensity").setDesc("Set the gradient opacity. Zero disables the gradient.").addSlider((slider) => slider.setLimits(0, 100, 1).setValue(profile.variables.tabBarGradientIntensity).setDynamicTooltip().onChange((value) => this.updateProfile({
          variables: { tabBarGradientIntensity: value }
        }, context)));
        new Setting(section).setName("Reset global appearance").setDesc("Restores global colors and tab bar appearance to Minimal defaults.").addButton((button) => button.setButtonText("Reset").onClick(() => this.updateProfile({
          variables: this.plugin.profileManager.builtInProfiles[0].variables,
          replaceVariables: true
        }, context, true)));
        const advanced = section.createEl("details", { cls: "cs-subsection" });
        advanced.createEl("summary", { text: "Advanced global CSS" });
        advanced.createEl("p", { text: "Advanced rules can affect any matching Obsidian interface element." });
        new Setting(advanced).setName("Profile CSS").addTextArea((text) => {
          text.setPlaceholder("Optional profile-wide CSS").setValue(profile.customCss);
          text.inputEl.addClass("cs-code-input");
          text.inputEl.addEventListener("blur", () => this.updateProfile({
            customCss: text.getValue()
          }, context));
        });
      }
      displayModules(containerEl, context) {
        const profile = this.plugin.profileManager.getActiveProfile();
        const section = containerEl.createEl("div", { cls: "cs-section cs-integrations" });
        if (!this.isCustom(profile)) {
          section.createEl("p", { text: "Duplicate the active built-in profile to configure modules." });
          return;
        }
        if (!MODULES.some((module3) => module3.id === context.moduleId)) context.moduleId = MODULES[0].id;
        const integrationTabs = section.createEl("div", {
          cls: "cs-integration-tabs",
          attr: { role: "tablist", "aria-label": "Integrations" }
        });
        const activeModule = MODULES.find((module3) => module3.id === context.moduleId);
        const modulePanel = section.createEl("section", {
          cls: "cs-integration-panel",
          attr: {
            role: "tabpanel",
            tabindex: "0",
            id: `cs-${context.viewKey}-integration-panel`,
            "aria-label": `${activeModule.name} settings`
          }
        });
        modulePanel.setAttribute("aria-labelledby", `cs-${context.viewKey}-integration-${activeModule.id}`);
        const tabElements = [];
        for (const [index, module3] of MODULES.entries()) {
          const tab = integrationTabs.createEl("button", {
            text: module3.name,
            attr: {
              type: "button",
              role: "tab",
              "aria-selected": String(module3.id === context.moduleId),
              tabindex: module3.id === context.moduleId ? "0" : "-1",
              "aria-controls": `cs-${context.viewKey}-integration-panel`
            }
          });
          tabElements.push(tab);
          tab.setAttribute("id", `cs-${context.viewKey}-integration-${module3.id}`);
          if (module3.id === context.moduleId) tab.addClass("is-active");
          tab.addEventListener("click", () => {
            context.focusIntegrationTab = index;
            this.setViewState(context, { moduleId: module3.id });
            this.refreshDisplay(context);
          });
          tab.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? MODULES.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + MODULES.length) % MODULES.length;
            context.focusIntegrationTab = nextIndex;
            this.setViewState(context, { moduleId: MODULES[nextIndex].id });
            this.refreshDisplay(context);
          });
        }
        this.decorateTabs(integrationTabs, tabElements, context, "integration");
        if (context.focusIntegrationTab !== void 0) {
          tabElements[context.focusIntegrationTab]?.focus();
          delete context.focusIntegrationTab;
        }
        this.displayModule(modulePanel, activeModule, profile, context);
      }
      displayModule(containerEl, module3, profile, context) {
        const detected = this.plugin.moduleManager.isTargetPluginEnabled(module3);
        const section = containerEl.createEl("div", { cls: "cs-module-section" });
        new Setting(section).setName(module3.name).setHeading();
        section.createEl("p", {
          text: detected ? "Target detected. Styling applies when a matching view is open." : module3.target.type === "core" ? "Obsidian Core Plugin is not enabled or its API is unavailable." : "Community plugin is not enabled."
        });
        if (module3.compatibilityNote) section.createEl("p", { cls: "cs-compatibility-note", text: module3.compatibilityNote });
        new Setting(section).setName("Enable customization").setDesc("Turning this off removes this module's styles and observers.").addToggle((toggle) => toggle.setValue(profile.moduleEnabled[module3.id] !== false).onChange((value) => this.runChange(async () => {
          this.plugin.profileManager.setModuleEnabled(module3.id, value);
          await this.persistChange(context);
          this.refreshProfilePreview(context);
        })));
        for (const group of module3.controlGroups) {
          const groupEl = section.createEl("details", { cls: "cs-subsection", attr: { open: true } });
          groupEl.createEl("summary", { text: group.name });
          for (const control of group.controls) {
            this.displayControl(groupEl, module3, profile, control, context);
          }
          if (module3.id === "kanban" && group.name === "Columns") {
            this.displayColumnOverrides(groupEl, module3, profile, context);
          }
        }
        const advanced = section.createEl("details", { cls: "cs-subsection" });
        advanced.createEl("summary", { text: "Advanced scoped CSS" });
        advanced.createEl("p", {
          text: `CSS selectors are scoped under ${module3.selectors.root}. @import and global at-rules are rejected.`
        });
        new Setting(advanced).setName("Module CSS").addTextArea((text) => {
          text.setPlaceholder("Optional module-specific CSS").setValue(profile.modules[module3.id].customCss);
          text.inputEl.addClass("cs-code-input");
          text.inputEl.addEventListener("blur", () => this.updateModule(module3.id, {
            customCss: text.getValue()
          }, context));
        });
        new Setting(section).setName("Reset module settings").setDesc("Restores this module's visual settings to their defaults.").addButton((button) => button.setButtonText("Reset").setWarning().onClick(() => this.runChange(async () => {
          this.plugin.profileManager.updateActiveProfile({
            modules: { [module3.id]: module3.defaultSettings }
          });
          await this.persistChange(context);
          this.refreshDisplay(context);
        })));
      }
      displayControl(containerEl, module3, profile, control, context) {
        const value = profile.modules[module3.id][control.key];
        const schema = module3.settingsSchema[control.key];
        const setting = new Setting(containerEl).setName(control.name);
        if (control.desc) setting.setDesc(control.desc);
        else if (control.unit) setting.setDesc(`Current value: ${value}${control.unit}`);
        const update = (next) => this.updateModule(module3.id, { [control.key]: next }, context);
        if (control.type === "color") {
          setting.addColorPicker((picker) => picker.setValue(value).onChange(update));
        } else if (control.type === "boolean") {
          setting.addToggle((toggle) => toggle.setValue(value).onChange(update));
        } else if (control.type === "range") {
          setting.addSlider((slider) => slider.setLimits(schema.min, schema.max, schema.step || 1).setValue(value).setDynamicTooltip().onChange(update));
        } else if (control.type === "select") {
          setting.addDropdown((dropdown) => {
            for (const option of schema.options) dropdown.addOption(option, option);
            dropdown.setValue(value).onChange(update);
          });
        } else if (control.type === "text") {
          setting.addText((text) => {
            text.setPlaceholder("Assets/cover.jpg or https://example.com/cover.jpg").setValue(value);
            text.inputEl.type = "text";
            text.inputEl.addEventListener("blur", () => update(text.getValue().trim()));
          });
        }
      }
      displayColumnOverrides(containerEl, module3, profile, context) {
        const names = this.plugin.moduleManager.getDetectedColumns(module3.id);
        containerEl.createEl("p", {
          text: names.length ? "Optional manual colors override automatic matching for these current columns." : "Open a Kanban board, then reopen settings to add per-column color overrides."
        });
        for (const name of names) {
          const colors = profile.modules[module3.id].columnColors;
          const currentColors = () => this.plugin.profileManager.getActiveProfile().modules[module3.id].columnColors;
          new Setting(containerEl).setName(name).addColorPicker((picker) => picker.setValue(colors[name] || this.plugin.profileManager.getActiveProfile().variables.accentColor || "#7c6ce7").onChange((value) => this.updateModule(module3.id, {
            columnColors: { ...currentColors(), [name]: value }
          }, context))).addButton((button) => button.setButtonText("Clear").onClick(() => {
            const next = { ...currentColors() };
            delete next[name];
            this.updateModule(module3.id, { columnColors: next }, context);
          }));
        }
      }
      addColorControl(containerEl, name, value, onChange) {
        new Setting(containerEl).setName(name).addColorPicker((picker) => picker.setValue(value).onChange(onChange));
      }
      isCustom(profile) {
        return this.plugin.profileManager.customProfiles.some((item) => item.id === profile.id);
      }
      updateProfile(update, context, refreshAfter = false) {
        return this.runChange(async () => {
          this.plugin.profileManager.updateActiveProfile(update);
          this.plugin.applyCustomization();
          this.refreshProfilePreview(context);
          if (refreshAfter) this.refreshDisplay(context);
          await this.persistChange(context, true);
        });
      }
      updateModule(moduleId, update, context) {
        return this.runChange(async () => {
          this.plugin.profileManager.updateModuleSettings(moduleId, update);
          this.plugin.applyCustomization();
          this.refreshProfilePreview(context);
          await this.persistChange(context, true);
        });
      }
      refreshProfilePreview(context) {
        if (!context?.preview) return;
        const profile = this.plugin.profileManager.getActiveProfile();
        context.preview.name.textContent = profile.name;
        const values = {
          Accent: profile.variables.accentColor,
          Surface: profile.variables.surfaceColor,
          Text: profile.variables.textColor,
          "Tab gradient": profile.variables.tabBarGradientColor
        };
        for (const swatch of context.preview.swatches) {
          const label = swatch.dataset.profileColor;
          const value = values[label];
          swatch.style.backgroundColor = value;
          swatch.setAttribute("title", `${label}: ${value}`);
          swatch.setAttribute("aria-label", `${label}: ${value}`);
        }
        const enabledModules = MODULES.filter((module3) => profile.moduleEnabled[module3.id] !== false).map((module3) => module3.name);
        context.preview.moduleSummary.textContent = enabledModules.length ? `Enabled modules: ${enabledModules.join(", ")}` : "No modules enabled.";
        context.preview.name.parentElement?.setAttribute(
          "aria-label",
          `Active profile: ${profile.name}`
        );
      }
      async persistChange(context, alreadyApplied = false) {
        if (!alreadyApplied) this.plugin.applyCustomization();
        this.refreshOtherViews(context);
        await this.plugin.settingsManager.scheduleSave();
      }
      runChange(change) {
        return change().catch((error) => {
          console.error("Customization Studio could not apply or save the requested change.", error);
          new Notice2(`Customization Studio: ${error.message}`);
        });
      }
    };
    module2.exports = { CustomizationSettingTab: CustomizationSettingTab2 };
  }
});

// core/settings-modal.js
var require_settings_modal = __commonJS({
  "core/settings-modal.js"(exports2, module2) {
    var { Modal } = require("obsidian");
    var CustomizationStudioModal2 = class extends Modal {
      constructor(app, settingsTab) {
        super(app);
        this.settingsTab = settingsTab;
      }
      onOpen() {
        this.setTitle("Customization Studio");
        this.modalEl.addClass("customization-studio-modal");
        this.contentEl.addClass("customization-studio-modal");
        this.settingsTab.displayInto(this.contentEl, "ribbonModal");
      }
      onClose() {
        this.settingsTab.releaseDisplayTarget(this.contentEl);
        this.contentEl.empty();
      }
    };
    module2.exports = { CustomizationStudioModal: CustomizationStudioModal2 };
  }
});

// src/main.js
var { Plugin, Notice } = require("obsidian");
var { SettingsManager } = require_settings_manager();
var { ProfileManager } = require_profile_manager();
var { ThemeEngine } = require_theme_engine();
var { ModuleManager } = require_module_manager();
var { CustomizationSettingTab } = require_settings_tab();
var { CustomizationStudioModal } = require_settings_modal();
module.exports = class CustomizationStudioPlugin extends Plugin {
  notifyUser(message) {
    new Notice(message);
  }
  async onload() {
    try {
      this.settingsManager = new SettingsManager(this);
      await this.settingsManager.load();
      this.profileManager = new ProfileManager(this.settingsManager);
      if (this.profileManager.load()) await this.settingsManager.save();
      this.themeEngine = new ThemeEngine(this);
      await this.themeEngine.loadCoreCss();
      this.moduleManager = new ModuleManager(this);
      this.moduleManager.load();
      this.settingsTab = new CustomizationSettingTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      this.register(() => this.settingsTab.dispose());
      this.settingsModal = new CustomizationStudioModal(this.app, this.settingsTab);
      this.registerCustomizationEntryPoints();
      this.applyCustomization();
      this.app.workspace.onLayoutReady(() => this.moduleManager.refreshWithNotice());
    } catch (error) {
      console.error("Customization Studio failed to start.", error);
      new Notice(`Customization Studio failed to start: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }
  applyCustomization() {
    const profile = this.profileManager.getActiveProfile();
    this.themeEngine.apply(profile);
    this.moduleManager.refresh(profile);
  }
  async saveCustomization() {
    this.applyCustomization();
    return this.settingsManager.scheduleSave();
  }
  openCustomizationSettings() {
    this.settingsModal.open();
  }
  registerCustomizationEntryPoints() {
    this.register(() => this.settingsModal.close());
    const ribbonIcon = this.addRibbonIcon(
      "paintbrush",
      "Open Customization Studio settings",
      () => this.openCustomizationSettings()
    );
    this.register(() => ribbonIcon.remove());
  }
  cleanup() {
    this.moduleManager?.unload();
    this.themeEngine?.unload();
  }
  async onunload() {
    let saveError;
    try {
      this.settingsModal?.close();
      if (this.settingsTab?.captureViewState()) await this.settingsManager?.save();
      await this.settingsManager?.flush();
    } catch (error) {
      saveError = error;
      console.error("Customization Studio could not persist its latest settings during unload.", error);
      new Notice(`Customization Studio could not save the latest settings: ${error.message}`);
    } finally {
      this.settingsManager?.settleWaiters(saveError);
      this.cleanup();
    }
  }
};
