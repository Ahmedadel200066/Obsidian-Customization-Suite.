const Module = require("node:module");
const original = Module._load;
// Minimal stand-in for the public host path helper in Node-only tests.
function hostNormalizePath(value) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "").replace(/\u00a0/g, " ").normalize();
}
Module._load = function(request, parent, isMain) {
  if (request === "obsidian") return { normalizePath: hostNormalizePath };
  return original.call(this, request, parent, isMain);
};
