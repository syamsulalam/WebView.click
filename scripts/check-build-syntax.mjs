import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDirs = ["src", "functions", "tests"];
const sourceFiles = ["server.ts", "vite.config.ts"];
const skippedDirs = new Set([".git", ".wrangler", "build", "dist", "node_modules"]);
const extensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

let transform;
try {
  ({ transform } = await import("esbuild"));
} catch {
  console.error("Build syntax check needs the local esbuild dependency. Run npm clean-install before npm run check:syntax.");
  process.exit(1);
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function loaderFor(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  return "js";
}

async function collectFiles(dirPath, output = []) {
  let entries = [];
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return output;
  }

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) await collectFiles(entryPath, output);
      continue;
    }

    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (extensions.has(path.extname(entry.name))) output.push(entryPath);
  }

  return output;
}

function formatFailure(filePath, error) {
  const errors = Array.isArray(error?.errors) && error.errors.length ? error.errors : [error];
  return errors
    .map((item) => {
      const location = item?.location;
      const text = item?.text || item?.message || String(item);
      if (!location) return `${relative(filePath)}: ${text}`;
      return `${relative(filePath)}:${location.line}:${location.column + 1}: ${text}`;
    })
    .join("\n");
}

const files = [];
for (const dir of sourceDirs) {
  await collectFiles(path.join(root, dir), files);
}
for (const file of sourceFiles) {
  files.push(path.join(root, file));
}

const uniqueFiles = Array.from(new Set(files)).sort((a, b) => relative(a).localeCompare(relative(b)));
const failures = [];

for (const filePath of uniqueFiles) {
  const source = await readFile(filePath, "utf8");
  try {
    await transform(source, {
      loader: loaderFor(filePath),
      sourcefile: relative(filePath),
      target: "es2022",
      jsx: "automatic",
      tsconfigRaw: {
        compilerOptions: {
          jsx: "react-jsx",
        },
      },
    });
  } catch (error) {
    failures.push(formatFailure(filePath, error));
  }
}

if (failures.length) {
  console.error(`Build syntax check failed in ${failures.length} file${failures.length === 1 ? "" : "s"}:\n`);
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Build syntax check passed for ${uniqueFiles.length} source files.`);
