import { readFile } from "node:fs/promises";
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
  JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  await readFile(path.join(root, "styles/core.css"), "utf8");
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
  plugins: [{
    name: "package-plugin",
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length) return;
        try {
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
