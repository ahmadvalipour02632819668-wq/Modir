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
  "assistant.js",
  "shell.js",
  "dashboard.js",
  "community.js",
  "finance.js",
  "management.js",
  "navigation.js",
];

if (!index.includes('href="./app.css?v=1"')) fail("index.html must load app.css");
if (index.includes("./app.js")) fail("obsolete monolithic app.js reference remains");
if (index.includes("<style>")) fail("application CSS must stay in app.css");

const actual = [...index.matchAll(/<script\s+src=["']\.\/([^"'?]+)(?:\?[^"']*)?["']/g)]
  .map((match) => match[1])
  .filter((name) => modules.includes(name));
if (JSON.stringify(actual) !== JSON.stringify(modules)) {
  fail(`JavaScript load order mismatch. Expected: ${modules.join(" -> ")}; found: ${actual.join(" -> ")}`);
}

for (const file of modules) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`missing module: ${file}`);
    continue;
  }
  if (!read(file).trim()) fail(`empty module: ${file}`);
}

const contracts = {
  "assistant.js": ["ModirAssistant", "mount"],
  "dashboard.js": ["ModirDashboard", "reqTable", "viewDash", "renderPollsInAnnouncements"],
  "community.js": ["ModirCommunity", "viewAnnouncements", "viewNeighborAlerts", "viewRequests", "payModal", "viewPay"],
  "finance.js": ["ModirFinance", "viewTx", "viewReport"],
  "management.js": ["ModirManagement", "viewUnits", "viewRates", "viewSettings", "viewActivity", "viewProfile"],
};
for (const [file, names] of Object.entries(contracts)) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const source = read(file);
  const apiName = names[0];
  const apiStart = source.indexOf(`window.${apiName} = Object.freeze({`);
  if (apiStart < 0) {
    fail(`${file}: missing frozen public API ${apiName}`);
    continue;
  }
  const apiEnd = source.indexOf("});", apiStart);
  const apiBlock = source.slice(apiStart, apiEnd < 0 ? source.length : apiEnd);
  for (const method of names.slice(1)) {
    if (!apiBlock.includes(method)) fail(`${file}: public API ${apiName} does not expose ${method}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Structure check passed: ${modules.length} ordered JavaScript files, public API contracts and app.css.`);
