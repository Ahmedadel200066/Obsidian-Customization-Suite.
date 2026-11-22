// Optional host internals are isolated here. They are not part of Obsidian's
// stable public API. Return false when unavailable rather than throwing during
// startup, or falling back to styling another plugin's coincidental markup.
function isTargetEnabled(app, target) {
  for (const id of target.ids) {
    try {
      if (target.type === "core") {
        const registry = app?.internalPlugins;
        if (!registry) continue;
        if (registry.getEnabledPluginById?.(id)) return true;
        const entry = typeof registry.getPluginById === "function"
          ? registry.getPluginById(id) : registry.plugins?.[id];
        if (entry?.enabled === true) return true;
      } else {
        const registry = app?.plugins;
        if (!registry) continue;
        if (registry.enabledPlugins?.has?.(id)) return true;
        if (typeof registry.getPlugin === "function" && registry.getPlugin(id)) return true;
      }
    } catch {
      // A changed or unavailable optional registry must not crash the plugin.
    }
  }
  return false;
}

module.exports = { isTargetEnabled };
