const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");

test("standard release stylesheet matches its source", () => {
  assert.equal(read("styles.css"), read("styles/core.css"));
});

test("release bundle is standalone except for the Obsidian host API and preserves MIT notice", () => {
  const bundle = read("main.js");
  const imports = [...bundle.matchAll(/\brequire\((['"])([^'"]+)\1\)/g)].map((match) => match[2]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((name) => name === "obsidian"));
  assert.ok(bundle.includes(read("LICENSE").trim()));
  assert.match(bundle, /Copyright \(c\) 2026 Ahmed Adel/);
});

test("support uses the owner-approved destination in manifest and README, not a settings donation button", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.fundingUrl, "https://buymeacoffee.com/medoadel20y");
  assert.ok(read("README.md").includes(manifest.fundingUrl));
  assert.ok(read("core/settings-tab.js").includes("Support via plugin details."));
  assert.equal(read("core/settings-tab.js").includes("buymeacoffee.com"), false);
});

test("release workflow attaches standard assets individually as well as the ZIP", () => {
  assert.match(read(".github/workflows/release.yml"), /gh release upload[^\n]*main\.js manifest\.json styles\.css LICENSE/);
});
