import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const intermediateDir = path.join(root, ".build");
const distributionDir = path.join(root, "dist");
const watching = process.argv.includes("--watch");

async function packagePlugin() {
  const bundle = await readFile(path.join(intermediateDir, "main.js"), "utf8");
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

  await rm(distributionDir, { recursive: true, force: true });
  await mkdir(distributionDir, { recursive: true });
  await cp(path.join(intermediateDir, "main.js"), path.join(distributionDir, "main.js"));
  await cp(path.join(root, "manifest.json"), path.join(distributionDir, "manifest.json"));
  await cp(path.join(root, "styles"), path.join(distributionDir, "styles"), { recursive: true });
}

const buildContext = await esbuild.context({
  absWorkingDir: root,
  entryPoints: ["src/main.js"],
  outfile: ".build/main.js",
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
          await packagePlugin();
          console.log(`Packaged Obsidian plugin at ${path.relative(root, distributionDir)}/`);
        } catch (error) {
          return {
            errors: [{ text: `Could not package Obsidian plugin: ${error.message}` }]
          };
        }
      });
    }
  }]
});

if (watching) {
  await buildContext.watch();
  console.log("Watching plugin sources; packaged output will be refreshed in dist/.");
} else {
  try {
    const result = await buildContext.rebuild();
    if (result.errors.length) process.exitCode = 1;
  } finally {
    await buildContext.dispose();
  }
}
