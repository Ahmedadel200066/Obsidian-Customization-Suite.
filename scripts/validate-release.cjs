const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

async function validateRelease(root, tag) {
  const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
  const manifest = await readJson("manifest.json");
  const pkg = await readJson("package.json");
  const versions = await readJson("versions.json");
  assert.match(tag || "", /^\d+\.\d+\.\d+$/, "Release tag must be x.y.z without a v prefix");
  assert.equal(manifest.version, tag, "Release tag must equal manifest.version");
  assert.equal(pkg.version, tag, "package.json must match the release version");
  assert.equal(versions[tag], manifest.minAppVersion, "versions.json must record the minimum compatible app version");
  assert.equal(manifest.id, "customization-studio");
  assert.equal(manifest.name, "Customization Studio");
  assert.equal(manifest.author, "Ahmed Adel");
  for (const file of ["main.js", "manifest.json", "styles.css", "LICENSE"]) {
    assert.ok((await readFile(path.join(root, file))).length > 0, `${file} must not be empty`);
  }
  assert.equal(await readFile(path.join(root, "styles.css"), "utf8"), await readFile(path.join(root, "styles/core.css"), "utf8"));
  const bundle = await readFile(path.join(root, "main.js"), "utf8");
  const imports = [...bundle.matchAll(/\brequire\((['"])([^'"]+)\1\)/g)].map((match) => match[2]);
  assert.ok(imports.includes("obsidian") && imports.every((name) => name === "obsidian"), "Only the Obsidian host API may remain external");
  return manifest;
}

if (require.main === module) {
  validateRelease(path.join(__dirname, ".."), process.argv[2]).then(
    (manifest) => console.log(`Validated ${manifest.id} ${manifest.version} release assets.`),
    (error) => { console.error(error.message); process.exitCode = 1; }
  );
}
module.exports = { validateRelease };
