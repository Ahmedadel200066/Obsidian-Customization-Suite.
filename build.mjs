import { readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(root, "main.js");
const watching = process.argv.includes("--watch");

async function validatePluginBundle() {
  const bundle = await readFile(outputFile, "utf8");
  const imports = [...bundle.matchAll(/\brequire\((['"])([^'"]+)\1\)/g)]
    .map((match) => match[2]);
  const unresolvedLocalImports = imports.filter((specifier) =>
    specifier.startsWith("./") || specifier.startsWith("../")
  );
  if (unresolvedLocalImports.length) {
    throw new Error(`Bundle contains unresolved local imports: ${unresolvedLocalImports.join(", ")}`);
  }
  const unexpectedExternalImports = imports.filter((specifier) => specifier !== "obsidian");
  if (unexpectedExternalImports.length || !imports.includes("obsidian")) {
    throw new Error(
      `Expected only the Obsidian host API to remain external; found ${imports.join(", ") || "no imports"}.`
    );
  }
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  if (manifest.author !== "Ahmed Adel") {
    throw new Error(`Expected manifest author "Ahmed Adel"; found "${manifest.author}".`);
  }
  if (manifest.name !== "Customization Studio" || manifest.id !== "customization-studio") {
    throw new Error("Plugin name or ID changed unexpectedly in the root manifest.");
  }
  await readFile(path.join(root, "styles.css"), "utf8");
}

const buildContext = await esbuild.context({
  absWorkingDir: root,
  entryPoints: ["src/main.js"],
  outfile: "main.js",
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: "es2020",
  external: ["obsidian"],
  banner: { js: `/*\n${(await readFile(path.join(root, "LICENSE"), "utf8")).trim()}\n*/` },
  plugins: [{
    name: "package-plugin",
    setup(build) {
      build.onLoad({ filter: /[\\/]src[\\/]main\.js$/ }, async (args) => ({
        contents: await readFile(args.path, "utf8"),
        loader: "js",
        resolveDir: path.dirname(args.path),
        watchFiles: [path.join(root, "styles/core.css")]
      }));
      build.onEnd(async (result) => {
        if (result.errors.length) return;
        try {
          // Obsidian installs root-level release assets, not nested ZIP files.
          await copyFile(path.join(root, "styles/core.css"), path.join(root, "styles.css"));
          await validatePluginBundle();
          console.log(`Built installable plugin bundle at ${path.relative(root, outputFile)}.`);
        } catch (error) {
          return {
            errors: [{ text: `Plugin bundle validation failed: ${error.message}` }]
          };
        }
      });
    }
  }]
});

if (watching) {
  await buildContext.watch();
  console.log("Watching plugin sources; root main.js will be rebuilt on changes.");
} else {
  try {
    const result = await buildContext.rebuild();
    if (result.errors.length) process.exitCode = 1;
  } finally {
    await buildContext.dispose();
  }
}
