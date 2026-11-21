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


test("tag release validates the current compatibility map and rejects mismatched tags", async () => {
  const { validateRelease } = require("../scripts/validate-release.cjs");
  const manifest = await validateRelease(root, "0.1.0");
  assert.equal(manifest.minAppVersion, "1.9.0");
  await assert.rejects(() => validateRelease(root, "v0.1.0"), /without a v prefix/);
  await assert.rejects(() => validateRelease(root, "0.2.0"), /manifest.version/);
});

test("release workflow runs on tags and publishes only after verified draft assets", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /push:\s+tags:/);
  assert.match(workflow, /node scripts\/validate-release\.cjs/);
  assert.match(workflow, /git diff --exit-code -- main\.js styles\.css/);
  assert.ok(workflow.indexOf("gh release upload") < workflow.indexOf("gh release edit"));
  assert.match(workflow, /Refusing to replace its assets/);
});
