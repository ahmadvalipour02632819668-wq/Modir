import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const attributes = {};
const root = {
  setAttribute: (name, value) => { attributes[name] = value; },
  removeAttribute: (name) => { delete attributes[name]; }
};
const dots = ["default", "dark", "ocean"].map((theme) => ({
  dataset: { t: theme },
  active: false,
  classList: { toggle(name, force) { if (name === "active") this.owner.active = force; }, owner: null }
}));
for (const dot of dots) dot.classList.owner = dot;
const saved = {};
const document = { documentElement: root, querySelectorAll: (selector) => selector === ".theme-dot" ? dots : [] };
const localStorage = { setItem: (key, value) => { saved[key] = value; } };
const window = {};
vm.runInNewContext(fs.readFileSync(new URL("../theme-ui.js", import.meta.url), "utf8"), { window, document, localStorage, Object });

test("exposes an immutable theme API", () => {
  assert.equal(Object.isFrozen(window.ModirTheme), true);
  assert.equal(typeof window.ModirTheme.setTheme, "function");
});

test("applies, persists and reflects the selected theme", () => {
  window.ModirTheme.setTheme("dark");
  assert.equal(attributes["data-theme"], "dark");
  assert.equal(saved.bm_theme, "dark");
  assert.equal(dots[1].active, true);
  assert.equal(dots[0].active, false);
});

test("default theme removes the theme attribute and persists default", () => {
  window.ModirTheme.setTheme("default");
  assert.equal(Object.hasOwn(attributes, "data-theme"), false);
  assert.equal(saved.bm_theme, "default");
  assert.equal(dots[0].active, true);
  assert.equal(dots[1].active, false);
});
