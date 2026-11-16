import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error("CHECK FAILED:", message);
  process.exitCode = 1;
};

const index = read("index.html");
const modules = [
  "core.js",
  "shell.js",
  "dashboard.js",
  "community.js",
  "finance.js",
  "management.js",
  "navigation.js",
];

const cssRef = 'href="./app.css?v=1"';
if (!index.includes(cssRef)) fail("index.html must load app.css");
if (index.includes("./app.js")) fail("obsolete monolithic app.js reference remains");
if (index.includes("// Apply Theme from LocalStorage")) {
  fail("application logic must not be embedded in index.html");
}
if (index.includes("<style>")) fail("application CSS must stay in app.css");

let previous = -1;
const seenFunctions = new Map();
for (const file of modules) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`missing module: ${file}`);
    continue;
  }
  const source = read(file);
  if (!source.trim()) fail(`empty module: ${file}`);
  const ref = `src="./${file}?v=1"`;
  const position = index.indexOf(ref);
  if (position < 0) fail(`index.html does not load ${file}`);
  if (position <= previous) fail(`module order changed at ${file}`);
  previous = position;

  for (const match of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const name = match[1];
    if (seenFunctions.has(name)) {
      fail(`duplicate function declaration: ${name} in ${seenFunctions.get(name)} and ${file}`);
    } else {
      seenFunctions.set(name, file);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Structure check passed: ${modules.length} ordered JavaScript modules and app.css.`);
