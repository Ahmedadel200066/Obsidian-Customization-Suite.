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
      customizationEnabled: true,
      activeProfileId: "minimal",
      customProfiles: [],
      moduleEnabled: {},
      lastSeenVersion: null,
      showWhatsNew: true,
      uiState: {
        settingsTab: { section: "profiles", moduleId: "kanban", scrollTop: 0 },
        ribbonModal: { section: "profiles", moduleId: "kanban", scrollTop: 0 }
      }
    };
    var UI_SECTIONS = /* @__PURE__ */ new Set(["global", "profiles", "integrations", "advanced"]);
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
        this.freshInstall = data == null;
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
        const customizationEnabled = data.customizationEnabled ?? true;
        if (typeof customizationEnabled !== "boolean") {
          throw new Error("Customization Studio customizationEnabled must be a boolean.");
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
        const lastSeenVersion = data.lastSeenVersion ?? null;
        if (lastSeenVersion !== null && (typeof lastSeenVersion !== "string" || !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(lastSeenVersion))) {
          throw new Error("Customization Studio lastSeenVersion must be a version like 1.2.0.");
        }
        const showWhatsNew = data.showWhatsNew ?? true;
        if (typeof showWhatsNew !== "boolean") {
          throw new Error("Customization Studio showWhatsNew must be a boolean.");
        }
        this.settings = {
          ...DEFAULT_SETTINGS,
          lastSeenVersion,
          showWhatsNew,
          customizationEnabled,
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
        const appearanceSnapshot = this.plugin.presentation?.snapshot();
        const savedRevision = this.revision;
        this.dirty = false;
        const pending = this.saveQueue.catch(() => void 0).then(() => this.plugin.presentation ? this.plugin.presentation.save(snapshot, appearanceSnapshot) : this.plugin.saveData(snapshot));
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

// core/selective-styles.js
var require_selective_styles = __commonJS({
  "core/selective-styles.js"(exports2, module2) {
    function blocks(css, context = [], result = /* @__PURE__ */ new Map()) {
      let cursor = 0;
      while (cursor < css.length) {
        const open = css.indexOf("{", cursor);
        if (open < 0) break;
        const selector = css.slice(cursor, open).trim();
        let end = open + 1, depth = 1, quote = null;
        for (; end < css.length; end++) {
          const c = css[end];
          if (quote) {
            if (c === "\\") end++;
            else if (c === quote) quote = null;
          } else if (c === '"' || c === "'") quote = c;
          else if (c === "{") depth++;
          else if (c === "}" && !--depth) break;
        }
        const body = css.slice(open + 1, end);
        if (selector.startsWith("@")) blocks(body, [...context, selector], result);
        else {
          let start = 0, parens = 0;
          quote = null;
          for (let i = 0; i <= body.length; i++) {
            const c = body[i];
            if (quote) {
              if (c === "\\") i++;
              else if (c === quote) quote = null;
              continue;
            }
            if (c === '"' || c === "'") {
              quote = c;
              continue;
            }
            if (c === "(") parens++;
            if (c === ")") parens--;
            if (c === ";" && parens === 0 || i === body.length) {
              const declaration = body.slice(start, i).trim(), colon = declaration.indexOf(":");
              if (colon > 0) {
                const property = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).trim(), key = JSON.stringify([context, selector, property]);
                result.set(key, { context, selector, property, value });
              }
              start = i + 1;
            }
          }
        }
        cursor = end + 1;
      }
      return result;
    }
    function alternative(definition, current) {
      if (definition.type === "boolean") return !current;
      if (definition.type === "color") return current === "#010203" ? "#a1b2c3" : "#010203";
      if (definition.type === "range") return current === definition.min ? definition.max : definition.min;
      if (definition.type === "select") return definition.options.find((v) => v !== current);
      if (definition.type === "colorMap") return {};
      return current ? "" : "test";
    }
    function selectiveStyles(module3, settings, controller, keys) {
      if (!keys.length) return "";
      const actual = blocks(module3.styles(settings, controller)), keep = /* @__PURE__ */ new Set();
      for (const key of keys) {
        const definition = module3.settingsSchema[key];
        if (!definition || key === "customCss" || key === "cardsShape") continue;
        const changed = { ...settings, [key]: alternative(definition, settings[key]) };
        const shadow = Object.create(controller);
        if (key === "backgroundImage") shadow.resolvedBackgroundImage = changed.backgroundImage;
        const other = blocks(module3.styles(changed, shadow));
        for (const [id, entry] of actual) if (!other.has(id) || other.get(id).value !== entry.value) keep.add(id);
        if (key === "columnColors" || key === "automaticColumnColors") {
          for (const [id, entry] of actual) if (entry.selector.includes("data-cs-kanban-column")) keep.add(id);
        }
      }
      const changedVariables = new Set([...keep].map((id) => actual.get(id).property).filter((name) => name.startsWith("--")));
      let consumersAdded = true;
      while (consumersAdded) {
        consumersAdded = false;
        for (const [id, entry] of actual) {
          const usesChanged = [...entry.value.matchAll(/var\((--[a-z0-9-]+)/gi)].some((match) => changedVariables.has(match[1]));
          if (usesChanged && !keep.has(id)) {
            keep.add(id);
            consumersAdded = true;
            if (entry.property.startsWith("--")) changedVariables.add(entry.property);
          }
        }
      }
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const id of [...keep]) {
          const entry = actual.get(id);
          for (const match of entry.value.matchAll(/var\((--[a-z0-9-]+)/gi)) for (const [dependency, item] of actual) if (item.property === match[1] && !keep.has(dependency)) {
            keep.add(dependency);
            expanded = true;
          }
        }
      }
      return [...actual].filter(([id]) => keep.has(id)).map(([, e]) => e.context.reduceRight((text, at) => `${at}{${text}}`, `${e.selector}{${e.property}:${e.value};}`)).join("\n");
    }
    module2.exports = { selectiveStyles, blocks };
  }
});

// modules/base-controller.js
var require_base_controller = __commonJS({
  "modules/base-controller.js"(exports2, module2) {
    var { selectiveStyles } = require_selective_styles();
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
        if (this.plugin.settingsManager?.settings.customizationEnabled === false || profile.moduleEnabled[this.module.id] === false || !this.manager.isTargetPluginEnabled(this.module)) {
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
        observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "src"] });
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
        const keys = this.profile?.studio?.moduleKeys[this.module.id] || [];
        const base = this.profile?.studio?.neutral ? selectiveStyles(this.module, this.settings, this, keys) : this.module.styles(this.settings, this);
        const css = `${base}
${this.module.customCss(this.settings, this)}
${this.additionalStyles?.() || ""}`;
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
        const keys = this.profile?.studio?.moduleKeys.kanban || [];
        if (this.profile?.studio?.neutral && !keys.some((key) => ["columnColors", "automaticColumnColors"].includes(key))) {
          for (const [element, record] of this.markedColumns) this.restoreColumnMarker(element, record);
          this.columnColorTokens.clear();
          return;
        }
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
        if (!this.settings.automaticColumnColors || this.profile?.studio?.neutral && !this.profile.studio.moduleKeys.kanban?.includes("automaticColumnColors")) return null;
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

// modules/bases/shape-options.js
var require_shape_options = __commonJS({
  "modules/bases/shape-options.js"(exports2, module2) {
    var HOVER_EFFECTS = Object.freeze({ off: "Off", glow: "Glow", lift: "Lift", flip: "Flip artwork", wiggle: "Wiggle" });
    var COMMON = { size: { name: "Artwork size", min: 50, max: 150, step: 1, default: 100, unit: "%", desc: "Uses native card sizing so artwork gets bigger or smaller without scaling or hiding the text." }, hover: { name: "Hover effect", options: Object.keys(HOVER_EFFECTS), default: "off" } };
    var SHAPE_CONTROLS = {
      standard: {},
      book: { angle: { name: "Book depth", min: 0, max: 20, default: 12, unit: "\xB0" }, pages: { name: "Page-edge thickness", min: 0, max: 12, default: 7, unit: "px" }, detail: { name: "Page-line spacing", min: 1, max: 4, step: 0.5, default: 2, unit: "px", desc: "Decorative page lines, not the note's actual page count." } },
      poster: { frame: { name: "Print border", min: 1, max: 16, default: 7, unit: "px" }, shadow: { name: "Print shadow", min: 0, max: 100, default: 40, unit: "%" } },
      circle: { diameter: { name: "Circle diameter", min: 60, max: 100, default: 100, unit: "%" }, crop: { name: "Vertical crop position", min: 0, max: 100, default: 50, unit: "%" } },
      spine: { angle: { name: "Closed spine angle", min: 40, max: 80, default: 72, unit: "\xB0" }, reveal: { name: "Reveal on hover or focus", default: true, desc: "Touch devices always show full covers." } },
      polaroid: { tilt: { name: "Print tilt", min: -6, max: 6, default: -2, unit: "\xB0" }, bottom: { name: "Lower border", min: 8, max: 45, default: 30, unit: "px" } },
      "trading-card": { frame: { name: "Metallic border", min: 1, max: 14, default: 6, unit: "px" }, sheen: { name: "Sheen strength", min: 0, max: 50, default: 20, unit: "%" } },
      disc: { protrusion: { name: "Disc protrusion", min: 0, max: 55, default: 34, unit: "%" }, diameter: { name: "Disc diameter", min: 60, max: 96, default: 92, unit: "%" } },
      ticket: { notch: { name: "Notch radius", min: 0, max: 14, default: 9, unit: "px" }, perforation: { name: "Perforated edges", default: true } }
    };
    function shapeSchema(shape) {
      if (!Object.hasOwn(SHAPE_CONTROLS, shape)) throw new Error("Unknown card shape.");
      return { ...COMMON, ...SHAPE_CONTROLS[shape] };
    }
    function validateShapeOptions(shape, value = {}) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Shape options must be an object.");
      const schema = shapeSchema(shape), result = {};
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema, key)) throw new Error(`Unknown ${shape} option: ${key}.`);
      for (const [key, definition] of Object.entries(schema)) {
        const current = value[key] ?? definition.default;
        if (definition.options ? !definition.options.includes(current) : typeof definition.default === "boolean" ? typeof current !== "boolean" : typeof current !== "number" || !Number.isFinite(current) || current < definition.min || current > definition.max) throw new Error(`Invalid ${shape} ${key}.`);
        result[key] = current;
      }
      return result;
    }
    module2.exports = { HOVER_EFFECTS, shapeSchema, validateShapeOptions };
  }
});

// modules/bases/card-shapes.js
var require_card_shapes = __commonJS({
  "modules/bases/card-shapes.js"(exports2, module2) {
    var { validateShapeOptions } = require_shape_options();
    var CARD_SHAPES = Object.freeze({
      standard: "Standard",
      book: "Book",
      poster: "Poster",
      circle: "Circle",
      spine: "Spine",
      polaroid: "Polaroid",
      "trading-card": "Trading card",
      disc: "Disc",
      ticket: "Ticket"
    });
    var SHAPE_ATTRIBUTE = "data-cs-bases-shape";
    function cardShapeStyles(shape, targetToken = "preview", inputOptions = {}, cardsScale = 1) {
      const options = validateShapeOptions(shape, inputOptions);
      if (shape === "standard" && options.size === 100 && options.hover === "off") return "";
      if (!Object.hasOwn(CARD_SHAPES, shape)) throw new Error("Unknown Bases card shape.");
      if (!/^cs-view-[0-9]+$|^preview$/.test(targetToken)) throw new Error("Invalid shape target token.");
      const root = `.bases-view[data-cs-bases-shape-target="${targetToken}"][${SHAPE_ATTRIBUTE}="${shape}"]`;
      const card = `${root} .bases-cards-item`;
      const cover = `${card} .bases-cards-cover`;
      const effects = {
        standard: "",
        book: `${cover} {
      container-type: size;
      --cs-book-width: min(90cqw, 56cqh);
      --cs-book-height: min(135cqw, 84cqh);
      --cs-book-shadow: #18382b30;
      background-size: 0 0 !important;
      background-color: transparent;
    }
    .theme-dark ${cover} { --cs-book-shadow: #0007; }
    ${cover}::before, ${cover} img {
      width: var(--cs-book-width); height: var(--cs-book-height);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) perspective(800px) rotateY(-${options.angle || 0}deg);
      border-radius: 2px 5px 5px 2px;
    }
    ${cover} img { position: absolute; object-fit: contain; z-index: 0; }
    ${cover}::before {
      background-image: inherit; background-size: contain; background-position: center; background-repeat: no-repeat;
      z-index: 1;
      box-shadow: 8px 11px 12px var(--cs-book-shadow), inset 0 0 0 1px #0003,
        inset 3px 0 1px #ffffff35, inset 8px 0 4px -4px #0009;
    }
    ${cover}::after {
      top: calc((100% - var(--cs-book-height)) / 2 + 3px);
      left: calc((100% + var(--cs-book-width)) / 2 - 2px);
      height: calc(var(--cs-book-height) - 5px); width: ${options.pages}px;
      ${options.pages === 0 ? "display: none;" : ""}
      transform: perspective(800px) rotateY(30deg); transform-origin: left;
      border: 1px solid #b9ad94; border-left: 0; z-index: 0;
      background: repeating-linear-gradient(#ede4d1 0 ${options.detail / 2}px, #c9bfa8 ${options.detail / 2}px ${options.detail}px);
      box-shadow: 2px 2px 1px #4b3e2e40;
    }`,
        poster: `${cover} { border: ${options.frame}px solid #faf8ef; outline: 1px solid #7775;
      box-shadow: 0 5px 12px rgba(0,0,0,${options.shadow / 200}); border-radius: 0; }`,
        circle: `${cover} { scale: ${options.diameter / 100}; border-radius: 50%; clip-path: circle(closest-side); overflow: hidden;
      background-size: cover !important; background-position: center ${options.crop}% !important; border: 3px solid var(--background-secondary);
      box-shadow: 0 3px 10px #0003; }
    ${cover} img { object-fit: cover; object-position: center ${options.crop}%; border-radius: 50%; }`,
        spine: `${card} { perspective: 850px; }
    ${cover} { transform: scale(.8) rotateY(-${options.angle}deg); transform-origin: 20% center;
      border-radius: 2px 5px 5px 2px; box-shadow: 7px 5px 9px #0004;
      transition: transform 180ms ease; }
    ${cover}::before { inset: 0; background: linear-gradient(90deg, #0006, #fff4 8%, transparent 18%); }
    ${options.reveal ? `${card}:is(:hover, :focus-within) .bases-cards-cover { transform: none; }` : ""}
    ${cover}:dir(rtl) { transform: scale(.8) rotateY(${options.angle}deg); transform-origin: 80% center; }
    ${options.reveal ? `${card}:dir(rtl):is(:hover, :focus-within) .bases-cards-cover { transform: none; }` : ""}
    @media (hover: none), (pointer: coarse) { ${cover}, ${cover}:dir(rtl) { transform: none; } }`,
        polaroid: `${cover} { border: 8px solid #fffdf7; border-block-end-width: ${options.bottom}px;
      border-radius: 1px; transform: rotate(${options.tilt}deg); box-shadow: 0 4px 10px #0003; }
    ${cover}:dir(rtl) { transform: rotate(${-options.tilt}deg); }
`,
        "trading-card": `${cover} { border: ${options.frame}px solid #bca269; border-radius: 9px;
      outline: 1px solid #67542b; box-shadow: 0 3px 10px #0004; }
    ${cover}::before { inset: -4px; border-radius: 7px; border: 1px solid #fff9;
      background: linear-gradient(125deg, transparent 22%, rgba(255,255,255,${options.sheen / 100}) 33%, transparent 44%, transparent 65%, #8ad3dd33 78%, transparent); }`,
        disc: `${card} { isolation: isolate; }
    ${cover} { isolation: auto; container-type: size; width: 82%;
      border: 1px solid #7775; border-radius: 1px; box-shadow: 0 3px 8px #0004; }
    ${cover}::after { width: min(${options.diameter}cqw, ${options.diameter}cqh); height: min(${options.diameter}cqw, ${options.diameter}cqh); inset-inline-start: ${options.protrusion}%; top: 4%;
      border-radius: 50%; z-index: -1;
      background: radial-gradient(circle, var(--background-primary) 0 4%, #d1b685 4% 16%, #27272b 16% 18%, transparent 18%),
        repeating-radial-gradient(circle, #161619 0 2px, #34343b 2px 3px, #17171b 3px 5px);
      box-shadow: 2px 3px 7px #0004; }
    ${cover} img { border-radius: 0; }`,
        ticket: `${cover} { border-block: 3px solid var(--background-modifier-border);
      border-inline: 2px ${options.perforation ? "dashed" : "solid"} var(--text-muted); border-radius: 9px; }
    ${cover}::before, ${cover}::after { width: ${options.notch * 2}px; height: ${options.notch * 2}px; top: calc(66% - ${options.notch}px);
      border-radius: 50%; background: var(--background-primary); }
    ${cover}::before { inset-inline-start: -${options.notch + 2}px; }
    ${cover}::after { inset-inline-end: -${options.notch + 2}px; }`
      };
      const bookFallback = shape === "book" ? `${cover} { background-size: contain !important; }
    ${cover}::before, ${cover}::after { display: none; }
    ${cover} img { width: 100%; height: 100%; top: 0; left: 0; transform: none; object-fit: contain; }` : "";
      const motionName = `cs-${targetToken}-${shape}-${options.hover}`;
      const animations = { flip: `@keyframes ${motionName}{from{rotate:y 0deg}to{rotate:y 360deg}}`, wiggle: `@keyframes ${motionName}{0%,100%{rotate:0deg}25%{rotate:2deg}75%{rotate:-2deg}}`, lift: "" };
      let hover = "";
      if (options.hover !== "off") {
        const effect = options.hover === "glow" ? "filter: drop-shadow(0 0 7px var(--interactive-accent));" : options.hover === "lift" ? "translate: 0 -4px;" : `animation: ${motionName} ${options.hover === "flip" ? "650" : "360"}ms ease 1;`;
        hover = `${animations[options.hover] || ""}@media(hover:hover) and (pointer:fine){${card}:is(:hover,:focus-within) .bases-cards-cover{${effect}}}`;
      }
      const sizing = options.size === 100 ? "" : `${root}{--bases-cards-scale:${cardsScale * options.size / 100};}`;
      if (shape === "standard") return `${sizing}${hover}@media(prefers-reduced-motion:reduce){${cover}{animation:none!important;translate:none!important;rotate:none!important;}}`;
      return `${sizing}${card} { overflow: visible; }
${cover} { box-sizing: border-box; isolation: isolate; overflow: visible; background-size: contain;
  background-position: center; background-repeat: no-repeat;
  background-color: var(--background-secondary); }
${cover} img { width: 100%; height: 100%; object-fit: contain; display: block; }
${cover}::before, ${cover}::after { content: ""; position: absolute; pointer-events: none; }
${card} .bases-cards-property { z-index: 1; }
${card}:focus-within { outline: 2px solid var(--interactive-accent); outline-offset: 4px; }
${effects[shape]}
${hover}
@media (prefers-reduced-motion: reduce) { ${cover} { transition: none !important; animation: none !important; rotate: none !important; translate: none !important; } }
@media (forced-colors: active) { ${cover} { border: 1px solid CanvasText; box-shadow: none; }
  ${cover}::before, ${cover}::after { display: none; } ${bookFallback} }
${shape === "book" ? `@supports not (container-type: size) { ${bookFallback} }` : ""}
`;
    }
    module2.exports = { CARD_SHAPES, SHAPE_ATTRIBUTE, cardShapeStyles };
  }
});

// modules/bases/settings.js
var require_settings3 = __commonJS({
  "modules/bases/settings.js"(exports2, module2) {
    var { createDefaults, validateSettings } = require_settings_utils();
    var { CARD_SHAPES } = require_card_shapes();
    var SCHEMA = {
      cardsShape: { type: "select", default: "standard", options: Object.keys(CARD_SHAPES) },
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
          { key: "cardsShape", name: "Card shape", type: "select", desc: "Standard keeps native artwork unless you change its size or hover effect. Shape edits use the active or sole visible cards pane; choose Temporary shape target if ambiguous. This is session/pane scoped. Circle crops artwork; Spine has a separate reveal control and stays open on touch." },
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
    var { cardShapeStyles, SHAPE_ATTRIBUTE } = require_card_shapes();
    var nextShapeTargetToken = 0;
    function styles(settings, controller) {
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
}
`;
    }
    var BasesController = class extends BaseModuleController {
      constructor(...args) {
        super(...args);
        this.shapeTarget = null;
        this.shapeViews = /* @__PURE__ */ new Map();
        this.nextShapeViewId = 0;
      }
      additionalStyles() {
        if (!this.shapeTarget?.written) return "";
        const options = this.plugin.presentation?.getShapeOptions(this.settings.cardsShape) || {};
        const keys = this.profile?.studio?.moduleKeys.bases || [];
        const scale = this.profile?.studio?.neutral && !keys.includes("cardsScale") ? this.shapeTarget.baseScale : this.settings.cardsScale;
        return cardShapeStyles(this.settings.cardsShape, this.shapeTarget.token, options, scale || 1);
      }
      autoSelectShapeTarget() {
        if (this.shapeTarget) return;
        const workspace = this.plugin.app.workspace, leaf = workspace.getMostRecentLeaf?.() || workspace.activeLeaf;
        const views = [...this.shapeViews].filter(([, root]) => root.querySelector(".bases-cards-group") && (!root.getClientRects || root.getClientRects().length));
        const selected = views.find(([, root]) => leaf?.view?.containerEl?.contains(root)) || (views.length === 1 ? views[0] : null);
        if (selected) this.selectShapeTarget(selected[0]);
        else this.plugin.notifyUser?.("Choose the cards pane under Temporary shape target so the change applies to the right pane.");
      }
      onRootsUpdated(roots) {
        const known = new Set(this.shapeViews.values());
        for (const [id, root] of this.shapeViews) if (!roots.has(root)) this.shapeViews.delete(id);
        for (const root of roots) {
          if (!known.has(root)) this.shapeViews.set(`view-${++this.nextShapeViewId}`, root);
        }
        this.syncShapeTarget();
      }
      getShapeViews() {
        return [...this.shapeViews].filter(([, root]) => root.querySelector(".bases-cards-group")).map(([id, root], index) => {
          let name = `Open Bases cards pane ${index + 1}`;
          this.plugin.app.workspace.iterateAllLeaves?.((leaf) => {
            if (leaf.view?.containerEl?.contains(root)) {
              const displayName = leaf.view.getDisplayText?.();
              if (typeof displayName === "string" && displayName.trim()) name = displayName;
            }
          });
          return { id, name: `${name} (${index + 1})` };
        });
      }
      selectShapeTarget(id) {
        this.clearShapeTarget();
        if (!id) {
          this.updateStyle();
          return;
        }
        const root = this.shapeViews.get(id);
        const group = root?.querySelector(".bases-cards-group");
        if (!root || !this.roots.has(root) || !group || !this.plugin.profileManager.customProfiles.some((p) => p.id === this.profile.id)) {
          throw new Error("Choose an open Bases cards pane while a custom profile is active.");
        }
        if (root.getAttribute(SHAPE_ATTRIBUTE) !== null || root.getAttribute("data-cs-bases-shape-target") !== null) throw new Error("This view already has an external shape marker.");
        const baseScale = parseFloat(root.ownerDocument.defaultView?.getComputedStyle?.(root).getPropertyValue("--bases-cards-scale")) || 1;
        this.shapeTarget = { id, root, group, baseScale, profileId: this.profile.id, written: null, token: `cs-view-${++nextShapeTargetToken}` };
        root.setAttribute("data-cs-bases-shape-target", this.shapeTarget.token);
        this.syncShapeTarget();
        this.updateStyle();
      }
      syncShapeTarget() {
        const target = this.shapeTarget;
        if (!target) return;
        if (target.profileId !== this.profile?.id || !this.roots.has(target.root) || target.root.querySelector(".bases-cards-group") !== target.group) {
          this.clearShapeTarget();
          return;
        }
        if (target.root.getAttribute("data-cs-bases-shape-target") !== target.token) {
          this.clearShapeTarget();
          return;
        }
        const existing = target.root.getAttribute(SHAPE_ATTRIBUTE);
        if (existing !== target.written) {
          this.clearShapeTarget();
          return;
        }
        const options = this.plugin.presentation?.getShapeOptions(this.settings.cardsShape);
        if (this.settings.cardsShape === "standard" && (!options || options.size === 100 && options.hover === "off")) {
          target.root.removeAttribute(SHAPE_ATTRIBUTE);
          target.written = null;
        } else {
          target.written = this.settings.cardsShape;
          target.root.setAttribute(SHAPE_ATTRIBUTE, target.written);
        }
      }
      clearShapeTarget() {
        const target = this.shapeTarget;
        if (target?.written && target.root.getAttribute(SHAPE_ATTRIBUTE) === target.written) {
          target.root.removeAttribute(SHAPE_ATTRIBUTE);
        }
        if (target && target.root.getAttribute("data-cs-bases-shape-target") === target.token) {
          target.root.removeAttribute("data-cs-bases-shape-target");
        }
        this.shapeTarget = null;
      }
      onDomChanged() {
        this.syncShapeTarget();
      }
      onRootRemoved(root) {
        if (this.shapeTarget?.root === root) this.clearShapeTarget();
        for (const [id, view] of this.shapeViews) if (view === root) this.shapeViews.delete(id);
      }
      deactivate() {
        this.clearShapeTarget();
        this.shapeViews.clear();
        super.deactivate();
      }
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
        const result = [...this.builtInProfiles, ...this.customProfiles];
        const id = this.presentation?.state.defaultProfileId;
        return id ? [...result.filter((p) => p.id === id), ...result.filter((p) => p.id !== id)] : result;
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
        if (parsed?.format === "customization-studio-profile") {
          if (parsed.version !== 2 || !this.presentation) throw new Error("This profile needs the new appearance-enabled build.");
          appearance = parsed.appearance;
          if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)) throw new Error("The imported profile is missing its appearance settings.");
          parsed = parsed.profile;
        }
        const imported = validateProfile(parsed, this.knownModules);
        if (appearance) {
          for (const mode of ["light", "dark"]) for (const variant of [appearance.variants?.[mode], appearance.baseline?.[mode]]) {
            if (!variant) throw new Error("Missing imported light/dark variant.");
            validateProfile({ ...imported, variables: variant.variables, modules: variant.modules }, this.knownModules);
          }
          this.presentation.validateState({ version: 1, defaultProfileId: null, profiles: { [imported.id]: appearance } });
        }
        const id = this.makeUniqueId(imported.id);
        const profile = { ...imported, id };
        this.customProfiles.push(profile);
        if (this.presentation) this.presentation.state.profiles[id] = appearance ? JSON.parse(JSON.stringify(appearance)) : this.presentation.newMeta(profile, false);
        this.settingsManager.settings.customProfiles = this.customProfiles;
        this.settingsManager.settings.activeProfileId = profile.id;
        return profile;
      }
      exportProfile(id, legacy = false) {
        const profile = this.getProfile(id);
        if (!profile) throw new Error(`Unknown profile "${id}".`);
        if (this.presentation) {
          const current = this.presentation.resolveProfile(id), clean = this.presentation.legacyData({ customProfiles: [current] }).customProfiles[0];
          return JSON.stringify(legacy ? clean : { format: "customization-studio-profile", version: 2, profile: clean, appearance: this.presentation.meta(id) }, null, 2);
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
        this.presentation?.cloneProfile(sourceId, profile.id);
        this.settingsManager.settings.customProfiles = this.customProfiles;
        this.settingsManager.settings.activeProfileId = profile.id;
        return profile;
      }
      createFromDefault() {
        const id = this.presentation?.state.defaultProfileId;
        if (!id) return this.createCopyFromCurrent();
        const names = new Set(this.getProfiles().map((p) => p.name.toLowerCase()));
        let name = "Default copy", n = 2;
        while (names.has(name.toLowerCase())) name = `Default copy ${n++}`;
        return this.createCustomProfile(name, id);
      }
      createCopyFromCurrent() {
        const source = this.getActiveProfile();
        const base = source.name.replace(/ copy(?: [0-9]+)?$/i, "").slice(0, 88);
        const names = new Set(this.getProfiles().map((profile) => profile.name.toLowerCase()));
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
        this.presentation?.recordUpdate(update);
        this.customProfiles[index] = updated;
        this.settingsManager.settings.customProfiles = this.customProfiles;
        return updated;
      }
      updateModuleSettings(moduleId, update) {
        if (!this.knownModules.has(moduleId)) throw new Error(`Unknown customization module "${moduleId}".`);
        const module3 = this.modules.find((item) => item.id === moduleId), active = this.getActiveProfile();
        const followsTheme = active.modules[moduleId].useThemeColors === true && !Object.hasOwn(update, "useThemeColors") && Object.keys(update).some((key) => module3.settingsSchema[key]?.type === "color");
        const result = this.updateActiveProfile({ modules: { [moduleId]: followsTheme ? { ...update, useThemeColors: false } : update }, ...this.presentation ? { moduleEnabled: { [moduleId]: true } } : {} });
        if (followsTheme && this.presentation) {
          const { value } = this.presentation.variant(active.id);
          value.moduleKeys[moduleId] = value.moduleKeys[moduleId].filter((key) => key !== "useThemeColors");
        }
        return result;
      }
      setModuleEnabled(moduleId, enabled) {
        if (!this.knownModules.has(moduleId) || typeof enabled !== "boolean") {
          throw new Error(`Invalid module enabled state for "${moduleId}".`);
        }
        return this.updateActiveProfile({ moduleEnabled: { [moduleId]: enabled } });
      }
      deleteCustomProfile(id) {
        if (id === this.presentation?.state.defaultProfileId) throw new Error("Default is the editable template and cannot be deleted.");
        const index = this.customProfiles.findIndex((profile) => profile.id === id);
        if (index < 0) throw new Error(`Cannot delete built-in or unknown profile "${id}".`);
        this.customProfiles.splice(index, 1);
        if (this.presentation) delete this.presentation.state.profiles[id];
        this.settingsManager.settings.customProfiles = this.customProfiles;
        if (this.settingsManager.settings.activeProfileId === id) {
          this.settingsManager.settings.activeProfileId = this.presentation?.state.defaultProfileId || this.builtInProfiles[0].id;
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
        if (this.plugin.settingsManager?.settings.customizationEnabled === false) {
          this.pause();
          return;
        }
        profile = this.plugin.presentation?.resolveProfile(profile.id, this.body) || profile;
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
        const inherited = profile.studio?.neutral && profile.studio.appearance === "auto";
        const keys = inherited ? profile.studio.globalKeys : Object.keys(profile.variables);
        const declarations = [];
        for (const [key, [customProperty, obsidianProperty]] of Object.entries(VARIABLE_MAP)) if (keys.includes(key)) {
          declarations.push(`${customProperty}: ${profile.variables[key]};`, `${obsidianProperty}: var(${customProperty});`);
        }
        if (profile.studio && !inherited) {
          const p = profile.studio.palette;
          for (const [name, value] of Object.entries({ "--background-primary-alt": p.secondary, "--background-secondary": p.secondary, "--background-secondary-alt": p.secondaryAlt, "--background-modifier-border": p.border, "--background-modifier-border-hover": p.muted, "--background-modifier-hover": p.hover, "--text-muted": p.muted, "--text-faint": p.faint, "--text-accent": p.accent, "--text-on-accent": p.onAccent, "--interactive-accent-hover": p.accent, "--interactive-normal": p.secondary, "--interactive-hover": p.hover, "--background-modifier-form-field": p.secondary })) declarations.push(`${name}: ${value};`);
          declarations.push(`color-scheme: ${profile.studio.mode};`);
        } else if (keys.includes("accentColor")) declarations.push(`--text-accent: ${profile.variables.accentColor};`);
        const tab = [];
        if (!inherited || keys.includes("tabBarOpacity")) tab.push(`background-color: ${profile.variables.tabBarOpacity === 0 ? "transparent" : colorWithOpacity(profile.variables.surfaceColor, profile.variables.tabBarOpacity / 100)};`);
        if (!inherited || keys.some((k) => k.startsWith("tabBarGradient"))) tab.push(`background-image: ${tabBarGradient(profile.variables)};`);
        if (!inherited || keys.includes("tabBarBlur")) tab.push(`backdrop-filter: blur(${profile.variables.tabBarBlur}px);`, `-webkit-backdrop-filter: blur(${profile.variables.tabBarBlur}px);`);
        if (!declarations.length && !tab.length && !profile.customCss) {
          this.clearEffects(true);
          return;
        }
        if (this.previousClassState === null) this.previousClassState = this.body.classList.contains("customization-studio-enabled");
        if (this.previousProfile === null) this.previousProfile = this.body.dataset.customizationStudioProfile;
        this.body.classList.add("customization-studio-enabled");
        this.body.dataset.customizationStudioProfile = profile.id;
        this.appliedProfileId = profile.id;
        const selector = `body.customization-studio-enabled[data-customization-studio-profile="${profile.id}"]`;
        this.setStyle("variables", `${selector}{${declarations.join("\n")}}${tab.length ? `${selector} .workspace-tab-header-container{${tab.join("\n")}}` : ""}`);
        this.setStyle("profile", profile.customCss || "");
      }
      clearEffects(keepCore = false) {
        if (this.previousClassState !== null) {
          if (this.previousClassState === false) this.body.classList.remove("customization-studio-enabled");
          if (this.body.dataset.customizationStudioProfile === this.appliedProfileId) {
            if (this.previousProfile === void 0) delete this.body.dataset.customizationStudioProfile;
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
          if (this.plugin.settingsManager?.settings.customizationEnabled !== false) controller.start();
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
        if (this.plugin.settingsManager?.settings.customizationEnabled === false) return;
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
      pause() {
        if (this.pendingRefresh !== null) clearTimeout(this.pendingRefresh);
        this.pendingRefresh = null;
        for (const observer of this.documents.values()) observer?.disconnect();
        this.documents.clear();
        for (const controller of this.controllers.values()) controller.deactivate();
      }
      refresh(profile = this.plugin.profileManager.getActiveProfile()) {
        if (this.plugin.settingsManager?.settings.customizationEnabled === false) {
          this.pause();
          return;
        }
        this.watchDocuments();
        for (const controller of this.controllers.values()) controller.refresh(profile);
      }
      refreshWithNotice() {
        if (this.plugin.settingsManager?.settings.customizationEnabled === false) {
          this.pause();
          return;
        }
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

// core/presentation-manager.js
var require_presentation_manager = __commonJS({
  "core/presentation-manager.js"(exports2, module2) {
    var { validateShapeOptions } = require_shape_options();
    var MODES = ["auto", "light", "dark"];
    var copy = (value) => JSON.parse(JSON.stringify(value));
    var COLORS = {
      minimal: { light: ["#7657c9", "#faf9fc", "#292633"], dark: ["#9b8af5", "#202027", "#e5e3ed"] },
      "dark-academia": { light: ["#846031", "#f5efdf", "#3b3024"], dark: ["#b18a58", "#29231e", "#e6dac5"] },
      glassmorphism: { light: ["#346eae", "#f0f6fc", "#20354d"], dark: ["#77b4ec", "#17212d", "#e2eef8"] },
      colorful: { light: ["#b22f70", "#fff7fb", "#3d2637"], dark: ["#ed83b6", "#252331", "#f1e5ef"] },
      "focus-mode": { light: ["#496a59", "#f7f8f6", "#28332c"], dark: ["#a7b9a9", "#202620", "#e2e9e2"] }
    };
    function mix(a, b, amount) {
      return "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
    }
    function palette(variables, mode) {
      const background = variables.surfaceColor, text = variables.textColor, accent = variables.accentColor;
      return { background, text, accent, secondary: mix(background, text, 0.055), secondaryAlt: mix(background, text, 0.09), border: mix(background, text, 0.19), muted: mix(text, background, 0.3), faint: mix(text, background, 0.47), hover: mix(background, text, 0.09), onAccent: mode === "light" ? "#ffffff" : "#17151e" };
    }
    function detectMode(body) {
      if (body?.classList?.contains("theme-light") || body?.classList?.contains("light")) return "light";
      if (body?.classList?.contains("theme-dark") || body?.classList?.contains("dark")) return "dark";
      return body?.ownerDocument?.defaultView?.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    function asHex(value, fallback) {
      const text = String(value || "").trim();
      if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
      if (/^#[0-9a-f]{3}$/i.test(text)) return "#" + [...text.slice(1)].map((c) => c + c).join("");
      const match = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)/i);
      return match ? "#" + match.slice(1, 4).map((v) => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, "0")).join("") : fallback;
    }
    function themedModules(modules, variables, mode) {
      const result = copy(modules), p = palette(variables, mode);
      for (const values of Object.values(result)) for (const key of Object.keys(values)) {
        if (typeof values[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(values[key])) continue;
        if (/border|divider/i.test(key)) values[key] = p.border;
        else if (/(?:text|contentColor|headerColor|fieldText)/i.test(key)) values[key] = p.text;
        else if (/background|overlay/i.test(key)) values[key] = /container|overlay/i.test(key) ? p.background : p.secondary;
      }
      return result;
    }
    var PresentationManager2 = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.pm = plugin.profileManager;
        this.state = { version: 1, defaultProfileId: null, profiles: {} };
        this.pendingShapeTarget = false;
      }
      get path() {
        const config = this.plugin.app.vault.configDir.replace(/\/+$/, "");
        return `${(this.plugin.manifest.dir || `${config}/plugins/${this.plugin.manifest.id}`).replace(/\/+$/, "")}/studio-appearance.json`;
      }
      body() {
        return this.plugin.app.workspace.containerEl.ownerDocument.body;
      }
      hostMode() {
        return detectMode(this.body());
      }
      captureVariables() {
        const body = this.body(), mode = this.hostMode(), fallback = COLORS.minimal[mode];
        const style = body.ownerDocument.defaultView?.getComputedStyle?.(body) || globalThis.getComputedStyle?.(body);
        const get = (name) => {
          const raw = style?.getPropertyValue(name);
          if (!raw) return raw;
          if (/^#|^rgba?\(/i.test(raw.trim())) return raw;
          const canvas = body.ownerDocument.createElement("canvas"), context = canvas.getContext?.("2d");
          if (context) {
            context.fillStyle = raw;
            context.fillRect(0, 0, 1, 1);
            const data = context.getImageData(0, 0, 1, 1).data;
            return `rgb(${data[0]},${data[1]},${data[2]})`;
          }
          return raw;
        };
        return { ...this.pm.builtInProfiles[0].variables, accentColor: asHex(get("--interactive-accent"), fallback[0]), surfaceColor: asHex(get("--background-primary"), fallback[1]), textColor: asHex(get("--text-normal"), fallback[2]), tabBarOpacity: 0, tabBarBlur: 0, tabBarGradientIntensity: 0 };
      }
      newMeta(base, neutral = false) {
        const variants = {};
        for (const mode of ["light", "dark"]) {
          const colors = COLORS[base.id]?.[mode] || COLORS.minimal[mode];
          const variables = neutral && mode === this.hostMode() ? copy(base.variables) : { ...base.variables, accentColor: COLORS[base.id] ? colors[0] : base.variables.accentColor, surfaceColor: colors[1], textColor: colors[2] };
          if (!neutral && !COLORS[base.id] && mode === "dark") Object.assign(variables, base.variables);
          variants[mode] = { variables, modules: neutral ? copy(base.modules) : themedModules(base.modules, variables, mode), globalKeys: [], moduleKeys: {} };
        }
        return { neutral, mode: "auto", variants, baseline: copy(variants), shapes: { selected: base.modules.bases?.cardsShape || "standard", options: {} } };
      }
      validateState(raw) {
        if (!raw || raw.version !== 1 || !raw.profiles || typeof raw.profiles !== "object" || Array.isArray(raw.profiles)) throw new Error("Invalid appearance settings file. Restore its backup instead of overwriting it.");
        if (raw.defaultProfileId !== null && typeof raw.defaultProfileId !== "string") throw new Error("Invalid Default profile identifier.");
        for (const [id, meta] of Object.entries(raw.profiles)) {
          if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !meta || typeof meta.neutral !== "boolean" || !MODES.includes(meta.mode)) throw new Error("Invalid profile appearance record.");
          for (const mode of ["light", "dark"]) {
            const v = meta.variants?.[mode];
            if (!v || !Array.isArray(v.globalKeys) || !v.moduleKeys || typeof v.moduleKeys !== "object") throw new Error("Invalid light/dark variant.");
            if (v.globalKeys.some((key) => !Object.hasOwn(this.pm.builtInProfiles[0].variables, key))) throw new Error("Unknown global appearance key.");
            for (const [moduleId, keys] of Object.entries(v.moduleKeys)) {
              const module3 = this.pm.modules.find((m) => m.id === moduleId);
              if (!module3 || !Array.isArray(keys) || keys.some((key) => !Object.hasOwn(module3.settingsSchema, key))) throw new Error("Invalid integration override list.");
            }
            const base = this.pm.getProfile(id);
            if (base) {
              const { validateProfile } = require_profile_manager();
              validateProfile({ ...base, variables: v.variables, modules: v.modules }, this.pm.knownModules);
              const baseline = meta.baseline?.[mode];
              if (!baseline) throw new Error("Missing variant baseline.");
              validateProfile({ ...base, variables: baseline.variables, modules: baseline.modules }, this.pm.knownModules);
            }
          }
          if (!meta.shapes || typeof meta.shapes.selected !== "string" || !meta.shapes.options || typeof meta.shapes.options !== "object" || Array.isArray(meta.shapes.options)) throw new Error("Invalid shape settings.");
          validateShapeOptions(meta.shapes.selected);
          for (const [shape, options] of Object.entries(meta.shapes.options)) validateShapeOptions(shape, options);
        }
        return raw;
      }
      async load() {
        const adapter = this.plugin.app.vault.adapter;
        this.persistedData = copy(await this.plugin.loadData() ?? null);
        let raw, mainError, pendingRecovery = false;
        if (await adapter.exists(this.path)) {
          try {
            raw = JSON.parse(await adapter.read(this.path));
          } catch (error) {
            mainError = error;
          }
        }
        if (await adapter.exists(this.path + ".tmp")) {
          try {
            const pending = JSON.parse(await adapter.read(this.path + ".tmp"));
            this.validateState(pending);
            const current = JSON.stringify(this.persistedData);
            if (pending.transaction && [pending.transaction.before, pending.transaction.after].some((value) => JSON.stringify(value) === current)) {
              const { SettingsManager: SettingsManager2 } = require_settings_manager();
              const checkSettings = new SettingsManager2({ loadData: async () => pending.transaction.after });
              await checkSettings.load();
              const { ProfileManager: ProfileManager2 } = require_profile_manager();
              new ProfileManager2(checkSettings).load();
              raw = pending;
              pendingRecovery = true;
            }
          } catch (error) {
            console.warn("Customization Studio kept an unreadable pending-save journal; using the committed settings if valid.", error);
          }
        }
        if (mainError && !pendingRecovery) throw mainError;
        if (!raw && await adapter.exists(this.path + ".tmp")) throw new Error("The pending Customization Studio save cannot be recovered safely. Keep the settings files and restore a matching backup pair.");
        if (raw) {
          let recovery;
          if (raw.transaction) {
            const current = JSON.stringify(this.persistedData), after = JSON.stringify(raw.transaction.after), before = JSON.stringify(raw.transaction.before);
            if (current !== after) {
              if (current !== before) throw new Error("data.json and studio-appearance.json do not match. Restore a matching backup pair before loading this build.");
              const { SettingsManager: SettingsManager2 } = require_settings_manager();
              const temporary = new SettingsManager2({ loadData: async () => raw.transaction.after });
              await temporary.load();
              const { ProfileManager: ProfileManager2 } = require_profile_manager();
              const check = new ProfileManager2(temporary);
              check.load();
              this.plugin.settingsManager.settings = temporary.settings;
              this.pm.customProfiles = check.customProfiles;
              recovery = raw.transaction.after;
            }
          }
          this.state = this.validateState(raw);
          if (pendingRecovery) await this.writeSidecar(adapter, JSON.stringify(raw, null, 2));
          if (recovery) {
            await this.plugin.saveData(recovery);
            this.persistedData = copy(recovery);
            this.plugin.notifyUser?.("Recovered the latest Customization Studio settings after an interrupted save.");
          }
          if (pendingRecovery) await this.clearPendingSave(adapter);
        }
        let created = false;
        if (!this.state.defaultProfileId || !this.pm.getProfile(this.state.defaultProfileId)) {
          const variables = this.captureVariables();
          const base = this.pm.createCustomProfile("Default", this.pm.builtInProfiles[0].id);
          base.variables = variables;
          base.description = "Your current appearance. Nothing is overridden until you change a setting.";
          for (const module3 of this.pm.modules) base.moduleEnabled[module3.id] = false;
          this.state.defaultProfileId = base.id;
          this.state.profiles[base.id] = this.newMeta(base, true);
          this.plugin.settingsManager.settings.activeProfileId = base.id;
          created = true;
        }
        for (const base of this.pm.getProfiles()) if (!Object.hasOwn(this.state.profiles, base.id)) this.state.profiles[base.id] = this.newMeta(base, false);
        return created;
      }
      meta(id = this.plugin.settingsManager.settings.activeProfileId) {
        return Object.hasOwn(this.state.profiles, id) ? this.state.profiles[id] : null;
      }
      variant(id, body = this.body()) {
        const meta = this.meta(id);
        const mode = meta.mode === "auto" ? detectMode(body) : meta.mode;
        return { meta, mode, value: meta.variants[mode] };
      }
      resolveProfile(id, body = this.body()) {
        const base = this.pm.getProfile(id);
        const entry = this.meta(id);
        if (!base || !entry) return base;
        const { meta, mode, value } = this.variant(id, body);
        const effective = { ...base, variables: copy(value.variables), modules: copy(value.modules) };
        effective.modules.bases.cardsShape = meta.shapes.selected;
        Object.defineProperty(effective, "studio", { enumerable: false, value: { neutral: meta.neutral, mode, appearance: meta.mode, globalKeys: value.globalKeys, moduleKeys: value.moduleKeys, palette: palette(effective.variables, mode) } });
        return effective;
      }
      refreshInheritedPalette() {
        const id = this.plugin.settingsManager.settings.activeProfileId, meta = this.meta(id);
        if (!meta?.neutral || meta.mode !== "auto") return;
        const { value } = this.variant(id), captured = this.captureVariables();
        for (const key of ["accentColor", "surfaceColor", "textColor"]) if (!value.globalKeys.includes(key)) value.variables[key] = captured[key];
      }
      recordUpdate(update) {
        const id = this.plugin.settingsManager.settings.activeProfileId, { value } = this.variant(id);
        if (update.variables) {
          Object.assign(value.variables, update.variables);
          value.globalKeys = [.../* @__PURE__ */ new Set([...value.globalKeys, ...Object.keys(update.variables)])];
        }
        for (const [moduleId, settings] of Object.entries(update.modules || {})) {
          Object.assign(value.modules[moduleId], settings);
          value.moduleKeys[moduleId] = [.../* @__PURE__ */ new Set([...value.moduleKeys[moduleId] || [], ...Object.keys(settings).filter((k) => k !== "cardsShape")])];
          if (moduleId === "bases" && settings.cardsShape !== void 0) {
            this.meta(id).shapes.selected = settings.cardsShape;
            this.pendingShapeTarget = true;
          }
        }
      }
      cloneProfile(sourceId, newId) {
        const source = this.meta(sourceId);
        this.state.profiles[newId] = source ? copy(source) : this.newMeta(this.pm.getProfile(newId), false);
      }
      setMode(mode) {
        if (!MODES.includes(mode)) throw new Error("Choose Follow Obsidian, Light, or Dark.");
        this.meta().mode = mode;
      }
      getShapeOptions(shape = this.meta().shapes.selected) {
        return validateShapeOptions(shape, this.meta().shapes.options[shape]);
      }
      setShapeOptions(shape, update) {
        if (!this.pm.customProfiles.some((p) => p.id === this.plugin.settingsManager.settings.activeProfileId)) throw new Error("Create an editable profile first.");
        this.meta().shapes.options[shape] = validateShapeOptions(shape, { ...this.getShapeOptions(shape), ...update });
        this.pendingShapeTarget = true;
        this.pm.getProfile(this.plugin.settingsManager.settings.activeProfileId).moduleEnabled.bases = true;
      }
      resetShape(shape) {
        this.meta().shapes.options[shape] = validateShapeOptions(shape);
        this.pendingShapeTarget = true;
      }
      resetGlobal() {
        const { meta, mode, value } = this.variant(this.plugin.settingsManager.settings.activeProfileId);
        value.variables = copy(meta.baseline?.[mode]?.variables || this.captureVariables());
        value.globalKeys = [];
        this.pm.getProfile(this.plugin.settingsManager.settings.activeProfileId).variables = copy(value.variables);
      }
      resetControl(scope, key) {
        const id = this.plugin.settingsManager.settings.activeProfileId;
        if (!this.pm.customProfiles.some((profile) => profile.id === id)) throw new Error("Duplicate the preset before editing its controls.");
        const { meta, mode, value } = this.variant(id), base = this.pm.getProfile(id);
        if (scope === "global") {
          if (!Object.hasOwn(base.variables, key)) throw new Error("Unknown appearance control.");
          const restored2 = meta.baseline[mode].variables[key];
          value.variables[key] = copy(restored2);
          base.variables[key] = copy(restored2);
          value.globalKeys = value.globalKeys.filter((item) => item !== key);
          return restored2;
        }
        const module3 = this.pm.modules.find((item) => item.id === scope);
        if (!module3 || !Object.hasOwn(module3.settingsSchema, key) || key === "cardsShape") throw new Error("Unknown or separately managed integration control.");
        const restored = meta.baseline[mode].modules[scope][key] ?? module3.defaultSettings[key];
        value.modules[scope][key] = copy(restored);
        base.modules[scope][key] = copy(restored);
        const keys = (value.moduleKeys[scope] || []).filter((item) => item !== key);
        if (keys.length) value.moduleKeys[scope] = keys;
        else delete value.moduleKeys[scope];
        return restored;
      }
      resetModule(moduleId) {
        const { meta, mode, value } = this.variant(this.plugin.settingsManager.settings.activeProfileId);
        value.modules[moduleId] = copy(meta.baseline?.[mode]?.modules?.[moduleId] || this.pm.modules.find((m) => m.id === moduleId).defaultSettings);
        delete value.moduleKeys[moduleId];
        const base = this.pm.getProfile(this.plugin.settingsManager.settings.activeProfileId);
        base.modules[moduleId] = copy(value.modules[moduleId]);
        base.moduleEnabled[moduleId] = false;
        if (moduleId === "bases") {
          meta.shapes = { selected: "standard", options: {} };
        }
      }
      snapshot() {
        return copy(this.state);
      }
      legacyData(snapshot) {
        const value = copy(snapshot);
        for (const profile of value.customProfiles || []) if (profile.modules?.bases) delete profile.modules.bases.cardsShape;
        return value;
      }
      async backupSidecar(adapter, path) {
        try {
          if (await adapter.exists(path)) {
            const contents = await adapter.read(path);
            this.validateState(JSON.parse(contents));
            await adapter.write(path + ".bak", contents);
          }
        } catch (error) {
          if (!this.backupWarned) {
            this.backupWarned = true;
            console.warn("Customization Studio could not refresh studio-appearance.json.bak; saving without a new backup.", error);
          }
        }
      }
      async writeSidecar(adapter, serialized) {
        if (typeof adapter.process === "function" && await adapter.exists(this.path)) {
          await adapter.process(this.path, () => serialized);
        } else {
          await adapter.write(this.path, serialized);
        }
      }
      async clearPendingSave(adapter) {
        if (typeof adapter.remove !== "function") return;
        try {
          if (await adapter.exists(this.path + ".tmp")) await adapter.remove(this.path + ".tmp");
        } catch (error) {
          if (!this.pendingCleanupWarned) {
            this.pendingCleanupWarned = true;
            console.warn("Customization Studio saved settings but could not remove its pending-save journal.", error);
          }
        }
      }
      async save(snapshot, state) {
        const adapter = this.plugin.app.vault.adapter, path = this.path, temp = path + ".tmp";
        const next = this.legacyData(snapshot), document = { ...state, transaction: { before: this.persistedData ?? null, after: next } };
        const serialized = JSON.stringify(document, null, 2);
        await adapter.write(temp, serialized);
        await this.backupSidecar(adapter, path);
        await this.writeSidecar(adapter, serialized);
        await this.plugin.saveData(next);
        this.persistedData = copy(next);
        await this.clearPendingSave(adapter);
      }
    };
    module2.exports = { PresentationManager: PresentationManager2, detectMode, palette, copy };
  }
});

// core/settings-tab.js
var require_settings_tab = __commonJS({
  "core/settings-tab.js"(exports2, module2) {
    var { PluginSettingTab, Setting, Notice: Notice2 } = require("obsidian");
    var { MODULES } = require_module_manager();
    var { CARD_SHAPES } = require_card_shapes();
    var { shapeSchema, HOVER_EFFECTS } = require_shape_options();
    var CustomizationSettingTab2 = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.importText = "";
        this.renameValue = "";
        this.viewContexts = /* @__PURE__ */ new WeakMap();
        this.openViews = /* @__PURE__ */ new Set();
        this.viewSaveTimers = /* @__PURE__ */ new Set();
        this.pendingInputs = /* @__PURE__ */ new Map();
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
        context.overrideIndicators = [];
        context.preview = null;
        context.hasCompactToolbar = true;
        if (context.section === "profiles") context.section = "advanced";
        const active = this.plugin.profileManager.getActiveProfile();
        const header = containerEl.createEl("header", { cls: "cs-toolbar" });
        const profileControl = new Setting(header).setName("Profile").addDropdown((dropdown) => {
          for (const profile of this.plugin.profileManager.getProfiles()) dropdown.addOption(profile.id, profile.name);
          (dropdown.selectEl || dropdown.inputEl)?.setAttribute?.("aria-label", "Active profile");
          if (context.focusToolbar === "profile") {
            (dropdown.selectEl || dropdown.inputEl)?.focus?.();
            delete context.focusToolbar;
          }
          dropdown.setValue(active.id).onChange((id) => this.runChange(async () => {
            context.focusToolbar = "profile";
            this.plugin.profileManager.setActiveProfile(id);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          }));
        });
        profileControl.settingEl?.addClass("cs-toolbar-profile");
        if (this.plugin.presentation) new Setting(header).setName("Mode").addDropdown((dropdown) => {
          dropdown.addOption("auto", "Follow Obsidian").addOption("light", "Light").addOption("dark", "Dark");
          (dropdown.selectEl || dropdown.inputEl)?.setAttribute?.("aria-label", "Appearance mode");
          if (context.focusToolbar === "mode") {
            (dropdown.selectEl || dropdown.inputEl)?.focus?.();
            delete context.focusToolbar;
          }
          dropdown.setValue(this.plugin.presentation.meta().mode).onChange((mode) => this.runChange(async () => {
            context.focusToolbar = "mode";
            this.plugin.presentation.setMode(mode);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          }));
        });
        const enabled = this.plugin.settingsManager.settings.customizationEnabled !== false;
        const power = new Setting(header).setName("Customization").addToggle((toggle) => {
          const element = toggle.toggleEl || toggle.inputEl;
          element?.setAttribute?.("aria-label", "Customization Studio customization");
          toggle.setValue(enabled).onChange((value) => this.runChange(async () => {
            context.focusMasterToggle = true;
            await this.plugin.setCustomizationEnabled(value);
          }));
          if (context.focusMasterToggle) {
            element?.focus?.();
            delete context.focusMasterToggle;
          }
        });
        power.settingEl?.addClass("cs-toolbar-power");
        const manage = header.createEl("button", { text: "Manage profiles", cls: "cs-manage-profiles", attr: { type: "button" } });
        manage.addEventListener("click", () => {
          context.scrollTop = 0;
          this.setViewState(context, { section: "advanced" });
          this.refreshDisplay(context);
        });
        const search = header.createEl("input", { cls: "cs-page-search", attr: { type: "search", placeholder: "Search this page", "aria-label": "Search this page" } });
        search.value = context.searchQuery || "";
        search.addEventListener("input", () => {
          context.searchQuery = search.value;
          this.filterPage(context);
        });
        search.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            search.value = "";
            context.searchQuery = "";
            this.filterPage(context);
          }
        });
        const status = containerEl.createEl("p", { cls: "cs-view-status", attr: { role: "status", "aria-live": "polite" }, text: enabled ? "Changes apply immediately and save automatically." : "Paused. Edits are saved; effects return when enabled." });
        const layout = containerEl.createEl("div", { cls: "cs-settings-layout" });
        const navigation = layout.createEl("div", { cls: "cs-sidebar", attr: { role: "tablist", "aria-label": "Customization Studio settings", "aria-orientation": "vertical" } });
        const panel = layout.createEl("section", { cls: "cs-primary-panel", attr: { role: "tabpanel", tabindex: "0", id: `cs-${context.viewKey}-panel`, "aria-labelledby": `cs-${context.viewKey}-tab-${context.section}` } });
        context.panel = panel;
        const tabs = [["global", "Appearance"], ["integrations", "Plugins"], ["advanced", "Advanced"]];
        const pageSelect = containerEl.createEl("select", { cls: "cs-mobile-page", attr: { "aria-label": "Settings page" } });
        for (const [id, label] of tabs) pageSelect.createEl("option", { text: label, attr: { value: id } });
        pageSelect.value = context.section;
        if (layout.before) layout.before(pageSelect);
        pageSelect.addEventListener("change", () => {
          context.focusPageSelect = true;
          context.searchQuery = "";
          context.scrollTop = 0;
          this.setViewState(context, { section: pageSelect.value });
          this.refreshDisplay(context);
        });
        if (context.focusPageSelect) {
          pageSelect.focus();
          delete context.focusPageSelect;
        }
        const tabElements = [];
        for (const [index, [id, label]] of tabs.entries()) {
          const tab = navigation.createEl("button", { text: label, attr: { type: "button", role: "tab", "aria-selected": String(context.section === id), tabindex: context.section === id ? "0" : "-1", "aria-controls": `cs-${context.viewKey}-panel`, id: `cs-${context.viewKey}-tab-${id}` } });
          if (context.section === id) tab.addClass("is-active");
          const select = () => {
            context.focusPrimaryTab = index;
            context.searchQuery = "";
            context.scrollTop = 0;
            this.setViewState(context, { section: id });
            this.refreshDisplay(context);
          };
          tab.addEventListener("click", select);
          tab.addEventListener("keydown", (event) => {
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
            context.focusPrimaryTab = next;
            context.searchQuery = "";
            context.scrollTop = 0;
            this.setViewState(context, { section: tabs[next][0] });
            this.refreshDisplay(context);
          });
          tabElements.push(tab);
        }
        if (context.focusPrimaryTab !== void 0) {
          tabElements[context.focusPrimaryTab]?.focus();
          delete context.focusPrimaryTab;
        }
        if (context.section === "global") {
          panel.setAttribute("aria-label", "Appearance");
          this.displayGlobalSettings(panel, context);
        } else if (context.section === "integrations") {
          panel.setAttribute("aria-label", "Plugins");
          this.displayModules(panel, context);
        } else {
          panel.setAttribute("aria-label", "Advanced");
          this.displayAdvancedSettings(panel, context);
        }
        context.searchStatus = panel.createEl("p", { cls: "cs-search-status", attr: { role: "status", "aria-live": "polite" } });
        this.filterPage(context);
        this.animatePanel(context, `${context.section}:${context.moduleId}`);
        const footer = containerEl.createEl("footer", { cls: "cs-settings-footer" });
        footer.createEl("p", { text: "Support via plugin details." });
        containerEl.scrollTop = context.scrollTop;
      }
      reducedMotion(context) {
        return context?.containerEl?.ownerDocument?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      }
      animatePanel(context, key) {
        if (context.lastPanelKey && context.lastPanelKey !== key && !this.reducedMotion(context)) {
          context.panel?.animate?.([{ opacity: 0.9, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 160, easing: "ease-out" });
        }
        context.lastPanelKey = key;
      }
      createControlGroup(containerEl, title, context, key, defaultOpen = false) {
        const group = containerEl.createEl("details", { cls: "cs-subsection" });
        group.open = context?.groupStates?.[key] ?? defaultOpen;
        group.createEl("summary", { text: title });
        group.addEventListener("toggle", () => {
          if (!context?.searchQuery) {
            context.groupStates || (context.groupStates = {});
            context.groupStates[key] = group.open;
          }
          if (group.open && !this.reducedMotion(context)) for (const child of [...group.children].slice(1)) child.animate?.([{ opacity: 0.85, transform: "translateY(2px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 140, easing: "ease-out" });
        });
        return group;
      }
      decorateControl(setting, scope, key, component, context, initialProfile, onResetValue = () => {
      }) {
        if (!this.plugin.presentation || !setting.settingEl || key === "cardsShape") return;
        setting.settingEl.dataset.csControlScope = scope;
        setting.settingEl.dataset.csControlKey = key;
        const info = setting.infoEl || setting.settingEl.querySelector?.(".setting-item-info");
        const badge = info?.createEl("span", { cls: "cs-control-state", attr: { "aria-live": "polite" } });
        const reset = setting.controlEl?.createEl("button", { text: "Reset", cls: "cs-control-reset", attr: { type: "button", "aria-label": `Reset ${key} override` } });
        const refresh = (profile = this.plugin.profileManager.getActiveProfile()) => {
          const keys = scope === "global" ? profile.studio?.globalKeys : profile.studio?.moduleKeys[scope];
          const modified = keys?.includes(key) === true;
          const inherited = profile.studio?.neutral && (scope !== "global" || profile.studio.appearance === "auto");
          if (badge) {
            badge.textContent = modified ? "Modified" : inherited ? "Inherited" : "Profile default";
            badge.dataset.state = modified ? "modified" : "inherited";
            badge.title = inherited && !modified ? "Native styling is active. The control shows the stored profile baseline, not a live theme readout." : "This value belongs to the current profile variant.";
          }
          if (reset) {
            reset.disabled = !modified;
            reset.title = inherited ? "Remove only this override and inherit native styling." : "Restore this control to the profile baseline.";
          }
        };
        reset?.addEventListener("click", () => this.runChange(async () => {
          const restored = this.plugin.presentation.resetControl(scope, key);
          const pending = this.pendingInputs.get(component?.inputEl);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingInputs.delete(component.inputEl);
          }
          component?.setValue(restored);
          onResetValue(restored);
          (component?.colorPickerEl || component?.sliderEl || component?.selectEl || component?.toggleEl || component?.inputEl)?.focus?.();
          this.plugin.applyCustomization();
          this.refreshProfilePreview(context);
          await this.persistChange(context, true);
        }));
        (context.overrideIndicators || (context.overrideIndicators = [])).push(refresh);
        refresh(initialProfile);
      }
      filterPage(context) {
        const panel = context.panel;
        if (!panel?.querySelectorAll) return;
        const query = (context.searchQuery || "").trim().toLowerCase();
        let matches = 0;
        for (const row of panel.querySelectorAll(".setting-item")) {
          const visible = !query || row.textContent.toLowerCase().includes(query);
          row.hidden = !visible;
          if (visible) matches++;
        }
        for (const group of panel.querySelectorAll("details")) {
          if (query) {
            if (!group.dataset.csSearchOpen) group.dataset.csSearchOpen = group.open ? "open" : "closed";
            const visible = [...group.querySelectorAll(".setting-item")].some((row) => !row.hidden);
            group.hidden = !visible;
            if (visible) group.open = true;
          } else {
            group.hidden = false;
            if (group.dataset.csSearchOpen) {
              group.open = group.dataset.csSearchOpen === "open";
              delete group.dataset.csSearchOpen;
            }
          }
        }
        if (context.searchStatus) context.searchStatus.textContent = query ? matches ? `${matches} matching settings on this page.` : "No settings match on this page. Try another page or plugin." : "";
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
      queueLiveInput(element, change) {
        const previous = this.pendingInputs.get(element);
        if (previous) clearTimeout(previous.timer);
        const entry = { change, timer: setTimeout(() => this.flushLiveInput(element), 180) };
        this.pendingInputs.set(element, entry);
      }
      flushLiveInput(element) {
        const entry = this.pendingInputs.get(element);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pendingInputs.delete(element);
        return entry.change();
      }
      async flushLiveInputs() {
        await Promise.all([...this.pendingInputs.keys()].map((element) => this.flushLiveInput(element)));
      }
      dispose() {
        for (const entry of this.pendingInputs.values()) clearTimeout(entry.timer);
        this.pendingInputs.clear();
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
          text: isCustom ? "Editing your copy. Changes save automatically." : "Built-in preset. Use Manage profile > Duplicate to make an editable copy. Create from Default starts from your own template instead."
        });
        if (!context?.hasCompactToolbar) {
          new Setting(section).setName("Active profile").setDesc(`Currently selected: ${active.name}. ${this.plugin.settingsManager.settings.customizationEnabled === false ? "Changes apply when customization is enabled." : "Switching applies the profile immediately."}`).addDropdown((dropdown) => {
            for (const profile of this.plugin.profileManager.getProfiles()) {
              dropdown.addOption(profile.id, profile.name);
            }
            dropdown.setValue(active.id).onChange((id) => this.runChange(async () => {
              this.plugin.profileManager.setActiveProfile(id);
              this.plugin.applyCustomization();
              this.refreshAllViews();
              await this.persistChange(context, true);
              new Notice2(`Customization Studio: ${this.plugin.settingsManager.settings.customizationEnabled === false ? "selected" : "applied"} "${this.plugin.profileManager.getActiveProfile().name}".`);
            }));
          });
          if (this.plugin.presentation) new Setting(section).setName("Appearance").setDesc("Each profile has Light and Dark variants. Follow Obsidian uses the host/system theme; editing changes the current variant.").addDropdown((dropdown) => {
            dropdown.addOption("auto", "Follow Obsidian / system").addOption("light", "Light").addOption("dark", "Dark");
            dropdown.setValue(this.plugin.presentation.meta().mode).onChange((mode) => this.runChange(async () => {
              this.plugin.presentation.setMode(mode);
              this.plugin.applyCustomization();
              this.refreshAllViews();
              await this.persistChange(context, true);
            }));
          });
        }
        new Setting(section).setName("Create profile").setDesc("Start from your editable Default template, not an imposed preset. Rename the new profile later.").addButton((button) => button.setButtonText(this.plugin.presentation ? "Create from Default" : "Create copy from current").setCta().onClick(() => this.runChange(async () => {
          this.plugin.profileManager.createFromDefault();
          this.renameValue = "";
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
        })));
        const manage = section.createEl("details", { cls: "cs-subsection" });
        manage.createEl("summary", { text: "Manage profile" });
        {
          new Setting(manage).setName("Duplicate profile").setDesc("Create an independent copy of the active profile.").addButton((button) => button.setButtonText("Duplicate").onClick(() => this.runChange(async () => {
            this.plugin.profileManager.duplicateProfile(active.id);
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
        }
        if (isCustom) {
          new Setting(manage).setName("Rename profile").addText((text) => {
            text.inputEl.maxLength = 100;
            text.setPlaceholder(active.name).setValue(this.renameValue || active.name).onChange((value) => {
              this.renameValue = value;
            });
          }).addButton((button) => button.setButtonText("Rename").onClick(() => this.runChange(async () => {
            this.plugin.profileManager.renameCustomProfile(active.id, this.renameValue || active.name);
            this.renameValue = "";
            this.plugin.applyCustomization();
            this.refreshAllViews();
            await this.persistChange(context, true);
          })));
        }
        new Setting(manage).setName("Export profile").setDesc("Copy the active profile with both variants and per-shape settings. This format needs the new build.").addButton((button) => button.setButtonText("Copy JSON").onClick(() => this.runChange(async () => {
          if (!globalThis.navigator?.clipboard?.writeText) {
            throw new Error("Clipboard access is unavailable in this Obsidian environment.");
          }
          await globalThis.navigator.clipboard.writeText(
            this.plugin.profileManager.exportProfile(active.id)
          );
          new Notice2("Customization Studio: profile JSON copied.");
        }))).addButton((button) => button.setButtonText("Legacy JSON").onClick(() => this.runChange(async () => {
          if (!globalThis.navigator?.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
          await globalThis.navigator.clipboard.writeText(this.plugin.profileManager.exportProfile(active.id, true));
          new Notice2("Copied the current look in legacy format. Shape settings and the other variant are not included.");
        })));
        new Setting(manage).setName("Import profile").setDesc("Paste profile JSON. Imported IDs are made unique automatically.").addTextArea((text) => {
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
        if (isCustom && active.id !== this.plugin.presentation?.state.defaultProfileId) {
          new Setting(manage).setName("Delete profile").setDesc("Switches to Default if this is the active profile.").addButton((button) => button.setButtonText("Delete").setWarning().onClick(() => this.runChange(async () => {
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
        new Setting(section).setName("Appearance").setHeading();
        section.createEl("p", { cls: "cs-section-description", text: "Make it yours. Reset removes one override without changing your other settings." });
        const basics = this.createControlGroup(section, "Colors", context, "global:colors", true);
        const more = this.createControlGroup(section, "Tab bar details", context, "global:tabs");
        const controls = [
          { key: "accentColor", name: "Accent color", type: "color" },
          { key: "surfaceColor", name: "Surface color", type: "color" },
          { key: "textColor", name: "Text color", type: "color" },
          { key: "tabBarOpacity", name: "Tab bar background opacity", type: "range", min: 0, max: 100, desc: "Tab header background only. Labels and icons stay fully opaque." },
          { key: "tabBarBlur", name: "Tab bar backdrop blur", type: "range", min: 0, max: 24, desc: "Visible through a translucent tab bar. Zero disables blur." },
          { key: "tabBarGradientColor", name: "Tab bar gradient color", type: "color" },
          { key: "tabBarGradientType", name: "Tab bar gradient type", options: ["linear", "radial", "circle"] },
          { key: "tabBarGradientDirection", name: "Tab bar gradient direction", options: ["to right", "to left", "to bottom", "to top", "to bottom right", "to bottom left", "to top right", "to top left"] },
          { key: "tabBarGradientPosition", name: "Tab bar radial gradient position", options: ["center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"] },
          { key: "tabBarGradientIntensity", name: "Tab bar gradient intensity", type: "range", min: 0, max: 100, desc: "Zero disables the gradient." }
        ];
        for (const control of controls) {
          const setting = new Setting(control.key.startsWith("tabBar") ? more : basics).setName(control.name);
          if (control.desc) setting.setDesc(control.desc);
          let component;
          const update = (value) => this.updateProfile({ variables: { [control.key]: value } }, context);
          if (control.type === "color") setting.addColorPicker((picker) => {
            component = picker;
            picker.setValue(profile.variables[control.key]).onChange(update);
          });
          else if (control.type === "range") setting.addSlider((slider) => {
            component = slider;
            slider.setLimits(control.min, control.max, 1).setValue(profile.variables[control.key]).setDynamicTooltip().onChange(update);
          });
          else setting.addDropdown((dropdown) => {
            component = dropdown;
            for (const option of control.options) dropdown.addOption(option, option);
            dropdown.setValue(profile.variables[control.key]).onChange(update);
          });
          this.decorateControl(setting, "global", control.key, component, context, profile);
        }
        new Setting(section).setName("Reset global appearance").setDesc("Returns global controls to the captured Default baseline without imposing a preset.").addButton((button) => button.setButtonText("Reset").onClick(() => this.plugin.presentation ? this.runChange(async () => {
          this.plugin.presentation.resetGlobal();
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
        }) : this.updateProfile({ variables: this.plugin.profileManager.builtInProfiles[0].variables, replaceVariables: true }, context, true)));
      }
      displayAdvancedSettings(containerEl, context) {
        this.displayProfileSettings(containerEl, context);
        const profile = this.plugin.profileManager.getActiveProfile();
        const section = containerEl.createEl("div", { cls: "cs-section" });
        new Setting(section).setName("What's new").setDesc("Release notes and optional development support.").addButton((button) => button.setButtonText("Show what's new").onClick(() => this.plugin.showWhatsNew()));
        if (!this.isCustom(profile)) return;
        const advanced = section.createEl("details", { cls: "cs-subsection" });
        advanced.createEl("summary", { text: "Advanced global CSS" });
        advanced.createEl("p", { text: "Advanced rules can affect any matching Obsidian interface element." });
        new Setting(advanced).setName("Profile CSS").addTextArea((text) => {
          text.setPlaceholder("Optional profile-wide CSS").setValue(profile.customCss);
          text.inputEl.addClass("cs-code-input");
          text.onChange((value) => this.updateProfile({ customCss: value }, context));
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
        const sourceSelect = section.createEl("select", { cls: "cs-mobile-module", attr: { "aria-label": "Plugin settings" } });
        for (const module3 of MODULES) sourceSelect.createEl("option", { text: module3.name, attr: { value: module3.id } });
        sourceSelect.value = context.moduleId;
        sourceSelect.addEventListener("change", () => {
          context.focusModuleSelect = true;
          context.searchQuery = "";
          context.scrollTop = 0;
          this.setViewState(context, { moduleId: sourceSelect.value });
          this.refreshDisplay(context);
        });
        if (context.focusModuleSelect) {
          sourceSelect.focus();
          delete context.focusModuleSelect;
        }
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
            context.searchQuery = "";
            context.scrollTop = 0;
            this.setViewState(context, { moduleId: module3.id });
            this.refreshDisplay(context);
          });
          tab.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? MODULES.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + MODULES.length) % MODULES.length;
            context.focusIntegrationTab = nextIndex;
            context.searchQuery = "";
            context.scrollTop = 0;
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
          text: detected ? "Detected. Styling applies to open views." : module3.target.type === "core" ? "Obsidian Core Plugin is not enabled or its API is unavailable." : "Community plugin is not enabled."
        });
        if (context) {
          context.themeColorToggle = null;
          context.integrationEnabledToggle = null;
        }
        section.createEl("p", { cls: "cs-section-description", text: "Inherited controls keep native styling. Modify a control to override it." });
        if (module3.compatibilityNote) section.createEl("p", { cls: "cs-compatibility-note", text: module3.compatibilityNote });
        new Setting(section).setName("Enable customization").setDesc("Edits enable this integration automatically. Master pause still applies.").addToggle((toggle) => {
          if (context) context.integrationEnabledToggle = { id: module3.id, toggle };
          return toggle.setValue(profile.moduleEnabled[module3.id] !== false).onChange((value) => this.runChange(async () => {
            this.plugin.profileManager.setModuleEnabled(module3.id, value);
            await this.persistChange(context);
            this.refreshProfilePreview(context);
          }));
        });
        const selectedBasics = {
          kanban: ["columnBackground", "cardBackground", "cardRadius", "cardSpacing"],
          "spaced-repetition": ["cardBackground", "contentColor", "contentFontSize", "cardRadius"],
          bases: ["cardsShape", "tableTextSize", "tableRowHeight"]
        };
        const basicKeys = new Set(selectedBasics[module3.id] || module3.controlGroups[0]?.controls.slice(0, 4).map((control) => control.key) || []);
        const basics = this.createControlGroup(section, "Basics", context, `${module3.id}:basics`, true);
        const more = this.createControlGroup(section, "More settings", context, `${module3.id}:more`);
        for (const group of module3.controlGroups) {
          for (const control of group.controls.filter((control2) => basicKeys.has(control2.key))) this.displayControl(basics, module3, profile, control, context);
          const remaining = group.controls.filter((control) => !basicKeys.has(control.key));
          if (!remaining.length && !(module3.id === "kanban" && group.name === "Columns")) continue;
          const groupEl = this.createControlGroup(more, group.name, context, `${module3.id}:${group.name}`);
          for (const control of remaining) this.displayControl(groupEl, module3, profile, control, context);
          if (module3.id === "kanban" && group.name === "Columns") this.displayColumnOverrides(groupEl, module3, profile, context);
        }
        if (module3.id === "bases") {
          this.displayShapeOptions(more, context);
          this.displayCardShapeTarget(more, context);
        }
        const advanced = section.createEl("details", { cls: "cs-subsection" });
        advanced.createEl("summary", { text: "Advanced scoped CSS" });
        advanced.createEl("p", {
          text: `CSS selectors are scoped under ${module3.selectors.root}. @import and global at-rules are rejected.`
        });
        new Setting(advanced).setName("Module CSS").addTextArea((text) => {
          text.setPlaceholder("Optional module-specific CSS").setValue(profile.modules[module3.id].customCss);
          text.inputEl.addClass("cs-code-input");
          const change = () => this.updateModule(module3.id, { customCss: text.getValue() }, context);
          text.onChange(() => this.queueLiveInput(text.inputEl, change));
          text.inputEl.addEventListener("blur", () => this.flushLiveInput(text.inputEl));
        });
        new Setting(section).setName("Reset module settings").setDesc("Restores this module's visual settings to their defaults.").addButton((button) => button.setButtonText("Reset").setWarning().onClick(() => this.runChange(async () => {
          if (this.plugin.presentation) this.plugin.presentation.resetModule(module3.id);
          else this.plugin.profileManager.updateActiveProfile({ modules: { [module3.id]: module3.defaultSettings } });
          await this.persistChange(context);
          this.refreshDisplay(context);
        })));
      }
      displayShapeOptions(containerEl, context) {
        if (!this.plugin.presentation) return;
        const shape = this.plugin.profileManager.getActiveProfile().modules.bases.cardsShape;
        const options = this.plugin.presentation.getShapeOptions(shape), details = containerEl.createEl("details", { cls: "cs-subsection", attr: { open: true } });
        details.createEl("summary", { text: `${CARD_SHAPES[shape]} settings` });
        for (const [key, definition] of Object.entries(shapeSchema(shape))) {
          const setting = new Setting(details).setName(definition.name);
          const description = (value) => [definition.desc, key === "hover" ? "Artwork only. Motion is disabled for reduced motion and touch." : "", definition.unit ? `Current value: ${value}${definition.unit}` : ""].filter(Boolean).join(" ");
          setting.setDesc(description(options[key]));
          const update = (value) => this.runChange(async () => {
            this.plugin.presentation.setShapeOptions(shape, { [key]: value });
            setting.setDesc(description(value));
            this.plugin.applyCustomization();
            this.refreshProfilePreview(context);
            await this.persistChange(context, true);
          });
          if (definition.options) setting.addDropdown((dropdown) => {
            for (const value of definition.options) dropdown.addOption(value, HOVER_EFFECTS[value] || value);
            dropdown.setValue(options[key]).onChange(update);
          });
          else if (typeof definition.default === "boolean") setting.addToggle((toggle) => toggle.setValue(options[key]).onChange(update));
          else setting.addSlider((slider) => slider.setLimits(definition.min, definition.max, definition.step || 1).setValue(options[key]).setDynamicTooltip().onChange(update));
        }
        new Setting(details).setName("Reset this shape").addButton((button) => button.setButtonText("Reset").onClick(() => this.runChange(async () => {
          this.plugin.presentation.resetShape(shape);
          this.plugin.applyCustomization();
          this.refreshAllViews();
          await this.persistChange(context, true);
        })));
      }
      displayCardShapeTarget(containerEl, context) {
        const controller = this.plugin.moduleManager.controllers?.get("bases");
        const views = controller?.getShapeViews?.() || [];
        new Setting(containerEl).setName("Temporary shape target").setDesc("Select one open cards pane. Other Bases panes stay unchanged. Selection is not saved: reselect after restart, profile changes, reopening, or a detected cards-layout replacement. This is pane-scoped preview, not a persistent saved-view rule.").addDropdown((dropdown) => {
          dropdown.addOption("", "None (do not apply shapes)");
          for (const view of views) dropdown.addOption(view.id, view.name);
          dropdown.setValue(controller?.shapeTarget?.id || "").onChange((id) => this.runChange(async () => {
            controller?.selectShapeTarget(id);
            this.refreshOtherViews(context);
          }));
        }).addButton((button) => button.setButtonText("Refresh panes").onClick(() => {
          this.plugin.moduleManager.refreshWithNotice?.();
          this.refreshDisplay(context);
        }));
        containerEl.createEl("p", { cls: "cs-compatibility-note", text: "Shapes use Bases card-cover classes. Check your real vault, embeds and mobile before relying on them. Metadata stays outside the cover. No notes or cover images are changed." });
      }
      displayControl(containerEl, module3, profile, control, context) {
        const value = profile.modules[module3.id][control.key];
        const schema = module3.settingsSchema[control.key];
        const setting = new Setting(containerEl).setName(control.name);
        if (control.desc) setting.setDesc(control.desc);
        else if (control.unit) setting.setDesc(`Current value: ${value}${control.unit}`);
        let component;
        const update = async (next) => {
          if (control.unit) setting.setDesc(`Current value: ${next}${control.unit}`);
          await this.updateModule(module3.id, { [control.key]: next }, context, module3.id === "bases" && control.key === "cardsShape");
        };
        if (control.type === "color") {
          setting.addColorPicker((picker) => {
            component = picker;
            return picker.setValue(value).onChange(update);
          });
        } else if (control.type === "boolean") {
          setting.addToggle((toggle) => {
            component = toggle;
            if (control.key === "useThemeColors" && context) context.themeColorToggle = { id: module3.id, toggle };
            return toggle.setValue(value).onChange(update);
          });
        } else if (control.type === "range") {
          setting.addSlider((slider) => {
            component = slider;
            return slider.setLimits(schema.min, schema.max, schema.step || 1).setValue(value).setDynamicTooltip().onChange(update);
          });
        } else if (control.type === "select") {
          setting.addDropdown((dropdown) => {
            component = dropdown;
            for (const option of schema.options) dropdown.addOption(option, module3.id === "bases" && control.key === "cardsShape" ? CARD_SHAPES[option] : option);
            dropdown.setValue(value).onChange(update);
          });
        } else if (control.type === "text") {
          setting.addText((text) => {
            component = text;
            text.setPlaceholder("Assets/cover.jpg or https://example.com/cover.jpg").setValue(value);
            text.inputEl.type = "text";
            const change = () => update(text.getValue().trim());
            text.onChange(() => this.queueLiveInput(text.inputEl, change));
            text.inputEl.addEventListener("blur", () => this.flushLiveInput(text.inputEl));
          });
        }
        this.decorateControl(setting, module3.id, control.key, component, context, profile, (next) => {
          if (control.unit) setting.setDesc(`Current value: ${next}${control.unit}`);
        });
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
      updateModule(moduleId, update, context, refreshAfter = false) {
        return this.runChange(async () => {
          this.plugin.profileManager.updateModuleSettings(moduleId, update);
          this.plugin.applyCustomization();
          this.refreshProfilePreview(context);
          if (refreshAfter) this.refreshDisplay(context);
          await this.persistChange(context, true);
        });
      }
      refreshProfilePreview(context) {
        const selected = this.plugin.profileManager.getActiveProfile();
        if (context?.integrationEnabledToggle) {
          const { id, toggle } = context.integrationEnabledToggle;
          toggle.setValue(selected.moduleEnabled[id] !== false);
        }
        if (context?.themeColorToggle) {
          const { id, toggle } = context.themeColorToggle;
          toggle.setValue(selected.modules[id].useThemeColors);
        }
        for (const refresh of context?.overrideIndicators || []) refresh(selected);
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
        context.preview.moduleSummary.textContent = enabledModules.length ? `${this.plugin.settingsManager.settings.customizationEnabled === false ? "Configured" : "Enabled"} modules: ${enabledModules.join(", ")}` : "No modules enabled.";
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
    function applyModalScrollLayout(modalEl, contentEl, viewportHeight) {
      const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 800;
      const modalHeight = Math.max(100, Math.floor(height * 0.92));
      const contentHeight = Math.max(60, modalHeight - 110);
      const apply = (el, rules) => {
        for (const [name, value] of Object.entries(rules)) el.style?.setProperty(name, value, "important");
      };
      apply(modalEl, { display: "flex", "flex-direction": "column", "max-height": `${modalHeight}px`, "min-height": "0", overflow: "hidden" });
      apply(contentEl, { display: "block", position: "relative", flex: "1 1 auto", height: "auto", "min-height": "0", "max-height": `${contentHeight}px`, "overflow-x": "hidden", "overflow-y": "auto", "overscroll-behavior": "contain", "touch-action": "pan-y", "pointer-events": "auto" });
    }
    var CustomizationStudioModal2 = class extends Modal {
      constructor(app, settingsTab) {
        super(app);
        this.settingsTab = settingsTab;
      }
      onOpen() {
        this.setTitle("Customization Studio");
        this.modalEl.addClass("customization-studio-modal");
        this.contentEl.addClass("customization-studio-modal");
        this.contentEl.setAttribute("tabindex", "0");
        this.settingsTab.displayInto(this.contentEl, "ribbonModal");
        const win = this.contentEl.ownerDocument?.defaultView;
        this.resizeScrollLayout = () => applyModalScrollLayout(this.modalEl, this.contentEl, win?.visualViewport?.height || win?.innerHeight);
        this.resizeScrollLayout();
        win?.addEventListener("resize", this.resizeScrollLayout);
        win?.visualViewport?.addEventListener("resize", this.resizeScrollLayout);
        this.removeScrollResize = () => {
          win?.removeEventListener("resize", this.resizeScrollLayout);
          win?.visualViewport?.removeEventListener("resize", this.resizeScrollLayout);
        };
      }
      onClose() {
        this.removeScrollResize?.();
        this.removeScrollResize = null;
        this.settingsTab.releaseDisplayTarget(this.contentEl);
        this.contentEl.empty();
      }
    };
    module2.exports = { CustomizationStudioModal: CustomizationStudioModal2, applyModalScrollLayout };
  }
});

// core/whats-new.js
var require_whats_new = __commonJS({
  "core/whats-new.js"(exports2, module2) {
    var SUPPORT_URL = "https://buymeacoffee.com/medoadel20y";
    var WHATS_NEW = {
      "1.4.0": {
        summary: "A clearer settings layout, easier control resets, and fixes for Kanban styling and saving.",
        highlights: [
          "Find controls under Appearance, Plugins, and Advanced, with a sticky toolbar and search for the current page.",
          "Start with Basics and open More settings when needed. Inherited and Modified labels show which standard controls you changed, with individual Reset buttons.",
          "Enjoy cleaner spacing, keyboard focus, and subtle motion that respects reduced-motion preferences.",
          "Settings use the available width, including maximized windows, and color swatches stay round when resizing.",
          "Kanban color and opacity changes now apply correctly from a neutral profile.",
          "Save settings without destination-file collisions, with recovery for valid interrupted-save journals."
        ]
      },
      "1.3.0": {
        summary: "A version-aware What's new dialog and more reliable scrolling in the ribbon settings modal.",
        highlights: [
          "See release highlights after an update, with no automatic dialog on a fresh install.",
          "Reopen these notes from the Show what's new command or settings button.",
          "Support development through the centered Buy Me a Coffee button.",
          "Ribbon settings now keep their scroll area within the viewport, including when an older stylesheet is installed.",
          "Scroll bounds adapt when the window or mobile viewport changes."
        ]
      },
      "1.2.0": {
        summary: "Light and Dark profiles, a neutral Default profile, and nine card shapes for Obsidian Bases.",
        highlights: [
          "Neutral, editable Default profile created from your current appearance. Nothing changes until you adjust a setting.",
          "Follow Obsidian, Light, or Dark per profile, with separate Light and Dark values.",
          "Nine Bases card shapes with their own controls, artwork size, and optional Glow, Lift, Flip artwork, or Wiggle hover effects.",
          "Master Enabled/Paused switch. Changes apply instantly.",
          "Export and import now include both variants and shape settings.",
          'Fixed a repeating "file already exists" notice when saving settings.'
        ]
      }
    };
    function parseVersion(value) {
      const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
      return match ? match.slice(1).map(Number) : null;
    }
    function isNewerVersion(current, previous) {
      const a = parseVersion(current), b = parseVersion(previous);
      if (!a || !b) return false;
      for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
      return false;
    }
    function whatsNewAction2({ freshInstall, lastSeenVersion, currentVersion, enabled = true, entries = WHATS_NEW }) {
      if (freshInstall) return "record";
      if (lastSeenVersion === currentVersion) return "none";
      if (lastSeenVersion && !isNewerVersion(currentVersion, lastSeenVersion)) return "record";
      if (!enabled || !entries[currentVersion]) return "record";
      return "show";
    }
    module2.exports = { SUPPORT_URL, WHATS_NEW, isNewerVersion, whatsNewAction: whatsNewAction2 };
  }
});

// core/whats-new-modal.js
var require_whats_new_modal = __commonJS({
  "core/whats-new-modal.js"(exports2, module2) {
    var { Modal } = require("obsidian");
    var { SUPPORT_URL, WHATS_NEW } = require_whats_new();
    var WhatsNewModal2 = class extends Modal {
      constructor(app, { version, entry = WHATS_NEW[version], showOnUpdate = true, onToggle = () => {
      } }) {
        super(app);
        this.version = version;
        this.entry = entry;
        this.showOnUpdate = showOnUpdate;
        this.onToggle = onToggle;
      }
      onOpen() {
        this.setTitle(`What's new in Customization Studio ${this.version}`);
        this.modalEl.addClass("customization-studio-whatsnew-modal");
        const content = this.contentEl;
        content.addClass("customization-studio-whatsnew");
        if (!this.entry) {
          content.createEl("p", { text: "There are no release notes for this version." });
        } else {
          content.createEl("p", { cls: "cs-whatsnew-summary", text: this.entry.summary });
          const list = content.createEl("ul", { cls: "cs-whatsnew-list" });
          for (const item of this.entry.highlights) list.createEl("li", { text: item });
        }
        const support = content.createEl("div", { cls: "cs-whatsnew-support" });
        support.createEl("p", { text: "If Customization Studio is useful to you, you can support its development. It is optional, and every feature stays free." });
        const coffee = support.createEl("a", {
          cls: "cs-bmc-button",
          attr: { href: SUPPORT_URL, target: "_blank", rel: "noopener", "aria-label": "Buy me a coffee (opens Buy Me a Coffee)" }
        });
        const svgNs = "http://www.w3.org/2000/svg";
        const doc = coffee.ownerDocument;
        const svg = doc.createElementNS(svgNs, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("aria-hidden", "true");
        for (const [tag, attrs] of [
          ["path", { d: "M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z", fill: "#fff", stroke: "#0d0c22", "stroke-width": "1.8", "stroke-linejoin": "round" }],
          ["path", { d: "M17 9h1.5a2.5 2.5 0 0 1 0 5H16.6", fill: "none", stroke: "#0d0c22", "stroke-width": "1.8", "stroke-linecap": "round" }],
          ["path", { d: "M4 20.5h14", fill: "none", stroke: "#0d0c22", "stroke-width": "1.8", "stroke-linecap": "round" }],
          ["path", { d: "M9 3.5c-.8 1 .8 1.5 0 2.5M13 3.5c-.8 1 .8 1.5 0 2.5", fill: "none", stroke: "#0d0c22", "stroke-width": "1.5", "stroke-linecap": "round" }]
        ]) {
          const node = doc.createElementNS(svgNs, tag);
          for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
          svg.appendChild(node);
        }
        coffee.appendChild(svg);
        coffee.createEl("span", { text: "Buy me a coffee" });
        const footer = content.createEl("div", { cls: "cs-whatsnew-footer" });
        const label = footer.createEl("label", { cls: "cs-whatsnew-optout" });
        const box = label.createEl("input", { attr: { type: "checkbox" } });
        box.checked = !this.showOnUpdate;
        box.addEventListener("change", () => this.onToggle(!box.checked));
        label.createEl("span", { text: " Don't show this after updates" });
        const close = footer.createEl("button", { cls: "mod-cta", text: "Close" });
        close.addEventListener("click", () => this.close());
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = { WhatsNewModal: WhatsNewModal2 };
  }
});

// src/main.js
var { Plugin, Notice } = require("obsidian");
var { SettingsManager } = require_settings_manager();
var { ProfileManager } = require_profile_manager();
var { ThemeEngine } = require_theme_engine();
var { ModuleManager } = require_module_manager();
var { PresentationManager } = require_presentation_manager();
var { CustomizationSettingTab } = require_settings_tab();
var { CustomizationStudioModal } = require_settings_modal();
var { WhatsNewModal } = require_whats_new_modal();
var { whatsNewAction } = require_whats_new();
module.exports = class CustomizationStudioPlugin extends Plugin {
  notifyUser(message) {
    new Notice(message);
  }
  async onload() {
    try {
      this.settingsManager = new SettingsManager(this);
      await this.settingsManager.load();
      this.profileManager = new ProfileManager(this.settingsManager);
      this.profileManager.load();
      this.presentation = new PresentationManager(this);
      const initialized = await this.presentation.load();
      this.profileManager.presentation = this.presentation;
      if (initialized) await this.settingsManager.save();
      this.themeEngine = new ThemeEngine(this);
      await this.themeEngine.loadCoreCss();
      this.moduleManager = new ModuleManager(this);
      this.moduleManager.load();
      this.settingsTab = new CustomizationSettingTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      this.register(() => this.settingsTab.dispose());
      this.settingsModal = new CustomizationStudioModal(this.app, this.settingsTab);
      this.registerCustomizationEntryPoints();
      this.watchAppearance();
      this.applyCustomization();
      this.app.workspace.onLayoutReady(() => {
        this.moduleManager.refreshWithNotice();
        this.checkWhatsNew();
      });
    } catch (error) {
      console.error("Customization Studio failed to start.", error);
      new Notice(`Customization Studio failed to start: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }
  applyCustomization() {
    if (this.unloading) return;
    if (this.settingsManager.settings.customizationEnabled === false) {
      this.moduleManager.pause();
      this.themeEngine.pause();
      this.queueLiveRefresh(true);
      return;
    }
    const meta = this.presentation?.meta();
    if (meta?.neutral && meta.mode === "auto") {
      if (this.themeEngine.appliedProfileId && this.themeEngine.appliedProfileId !== this.settingsManager.settings.activeProfileId) this.themeEngine.pause();
      this.presentation.refreshInheritedPalette();
    }
    const profile = this.profileManager.getActiveProfile();
    this.themeEngine.apply(profile);
    this.moduleManager.refresh(profile);
    if (this.presentation?.pendingShapeTarget) {
      this.presentation.pendingShapeTarget = false;
      this.moduleManager.controllers?.get("bases")?.autoSelectShapeTarget?.();
    }
    this.queueLiveRefresh();
  }
  queueLiveRefresh(force = false) {
    if (!this.app?.workspace?.trigger) return;
    if (this.liveRefreshTimer !== void 0 && this.liveRefreshTimer !== null) clearTimeout(this.liveRefreshTimer);
    this.liveRefreshTimer = setTimeout(() => {
      this.liveRefreshTimer = null;
      if (this.unloading || !force && this.settingsManager.settings.customizationEnabled === false) return;
      const bases = this.moduleManager.controllers?.get("bases"), target = bases?.shapeTarget;
      this.broadcastingCssChange = true;
      try {
        this.app.workspace.trigger?.("css-change");
        this.app.workspace.trigger?.("resize");
      } finally {
        this.broadcastingCssChange = false;
      }
      if (target && bases.shapeTarget === target && bases.roots.has(target.root)) {
        const group = target.root.querySelector(".bases-cards-group");
        if (group) target.group = group;
        bases.syncShapeTarget();
        bases.updateStyle();
      }
    }, 16);
  }
  watchAppearance() {
    this.lastHostMode = this.presentation.hostMode();
    const changed = () => {
      if (this.unloading || this.broadcastingCssChange || this.settingsManager.settings.customizationEnabled === false) return;
      const mode = this.presentation.hostMode();
      if (mode === this.lastHostMode) return;
      this.lastHostMode = mode;
      this.themeEngine.pause();
      this.applyCustomization();
      this.settingsTab?.refreshAllViews();
    };
    const doc = this.app.workspace.containerEl.ownerDocument, Observer = doc.defaultView?.MutationObserver;
    if (Observer) {
      const observer = new Observer(changed);
      observer.observe(doc.body, { attributes: true, attributeFilter: ["class"] });
      this.register(() => observer.disconnect());
    }
    this.registerEvent(this.app.workspace.on("css-change", changed));
    const media = doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", changed);
    this.register(() => media?.removeEventListener?.("change", changed));
  }
  async setCustomizationEnabled(enabled) {
    if (typeof enabled !== "boolean") throw new Error("Customization state must be a boolean.");
    this.settingsManager.settings.customizationEnabled = enabled;
    this.applyCustomization();
    this.settingsTab?.refreshAllViews();
    await this.settingsManager.scheduleSave();
  }
  async saveCustomization() {
    this.applyCustomization();
    return this.settingsManager.scheduleSave();
  }
  showWhatsNew() {
    const version = this.manifest?.version;
    if (!version) return;
    const settings = this.settingsManager.settings;
    this.whatsNewModal?.close();
    this.whatsNewModal = new WhatsNewModal(this.app, {
      version,
      showOnUpdate: settings.showWhatsNew !== false,
      onToggle: (enabled) => {
        settings.showWhatsNew = enabled;
        this.settingsManager.scheduleSave().catch((error) => console.error("Customization Studio could not save the what's new preference.", error));
      }
    });
    this.whatsNewModal.open();
  }
  checkWhatsNew() {
    if (this.unloading) return;
    const settings = this.settingsManager.settings, version = this.manifest?.version;
    if (!version) return;
    const action = whatsNewAction({ freshInstall: this.settingsManager.freshInstall, lastSeenVersion: settings.lastSeenVersion, currentVersion: version, enabled: settings.showWhatsNew !== false });
    if (action === "none") return;
    settings.lastSeenVersion = version;
    this.settingsManager.freshInstall = false;
    this.settingsManager.scheduleSave().catch((error) => console.error("Customization Studio could not remember the last seen version.", error));
    if (action === "show") this.showWhatsNew();
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
    this.register(() => this.whatsNewModal?.close());
    this.addCommand({ id: "show-whats-new", name: "Show what's new", callback: () => this.showWhatsNew() });
  }
  cleanup() {
    this.unloading = true;
    if (this.liveRefreshTimer !== void 0 && this.liveRefreshTimer !== null) clearTimeout(this.liveRefreshTimer);
    this.liveRefreshTimer = null;
    this.moduleManager?.unload();
    this.themeEngine?.unload();
    this.app?.workspace?.trigger?.("css-change");
    this.app?.workspace?.trigger?.("resize");
  }
  async onunload() {
    let saveError;
    try {
      this.settingsModal?.close();
      await this.settingsTab?.flushLiveInputs?.();
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
