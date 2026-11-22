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

test("release workflow attaches only the three standard assets", () => {
  assert.match(read(".github/workflows/release.yml"), /gh release upload "\$RELEASE_TAG" main\.js manifest\.json styles\.css --clobber/);
});


test("tag release validates the current compatibility map and rejects mismatched tags", async () => {
  const { validateRelease } = require("../scripts/validate-release.cjs");
  const current = JSON.parse(read("manifest.json")).version;
  const manifest = await validateRelease(root, current);
  assert.equal(manifest.minAppVersion, "1.9.0");
  await assert.rejects(() => validateRelease(root, "v1.2.0"), /without a v prefix/);
  await assert.rejects(() => validateRelease(root, "999.0.0"), /manifest.version/);
});

test("release workflow runs on tags and publishes only after verified draft assets", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /push:\s+tags:/);
  assert.match(workflow, /node scripts\/validate-release\.cjs/);
  assert.match(workflow, /git diff --exit-code -- main\.js styles\.css/);
  assert.ok(workflow.indexOf("gh release upload") < workflow.indexOf("gh release edit"));
  assert.match(workflow, /Refusing to replace its assets/);
});


test("manifest description follows the observed directory scan rule", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.doesNotMatch(manifest.description, /obsidian/i);
  assert.ok(manifest.description.length <= 250 && manifest.description.endsWith("."));
});

test("release provenance covers the exact three assets before upload without extra release files", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /attestations: write/);
  assert.match(workflow, /actions\/attest@v4/);
  assert.match(workflow, /subject-path: \|\s+main\.js\s+manifest\.json\s+styles\.css/);
  assert.ok(workflow.indexOf("actions/attest@v4") < workflow.indexOf("gh release upload"));
  assert.doesNotMatch(workflow, /Customization-Studio\.zip|styles\.css LICENSE/);
  assert.match(workflow, /Expected exactly three standard release assets/);
});

test("active-tab CSS keeps its fallback without duplicate background declarations", () => {
  const css = read("styles/core.css");
  for (const match of css.matchAll(/\{([^{}]*)\}/g)) {
    const backgrounds = [...match[1].matchAll(/(?:^|;)\s*background\s*:/g)];
    assert.ok(backgrounds.length <= 1, "No rule may declare background twice");
  }
  assert.match(css, /@supports \(background: color-mix/);
  assert.match(css, /background: var\(--background-modifier-hover\)/);
});


test("release preserves the prior compatibility mapping and all version files agree", () => {
  const version = JSON.parse(read("manifest.json")).version;
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(version, "1.4.0");
  assert.equal(JSON.parse(read("package.json")).version, version);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[""].version, version);
  const versions = JSON.parse(read("versions.json"));
  assert.equal(versions["0.1.0"], "1.9.0");
  assert.equal(versions["0.1.1"], "1.9.0");
  assert.equal(versions["1.2.0"], "1.9.0");
  assert.equal(versions["1.3.0"], "1.9.0");
  assert.equal(versions[version], "1.9.0");
});
