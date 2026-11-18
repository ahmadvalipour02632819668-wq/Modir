import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync(new URL("../icons.js", import.meta.url), "utf8"), {
  window, Object
});
const icons = window.ModirIcons;

test("exposes a frozen shared icon API and catalogs", () => {
  assert.ok(icons);
  assert.equal(Object.isFrozen(icons), true);
  assert.equal(Object.isFrozen(icons.ICONS), true);
  assert.equal(Object.isFrozen(icons.LINE_ICONS), true);
});

test("provides icons required by navigation and profile views", () => {
  for (const key of ["settings", "dash", "units", "announcements", "requests", "tx", "pay", "report", "rates", "activity", "profile", "services", "logout"]) {
    assert.equal(typeof icons.ICONS[key], "string", key + " icon must exist");
  }
});

test("preserves line icon aliases and fallback behavior", () => {
  assert.equal(icons.LINE_ICONS.services, icons.ICONS.services);
  assert.equal(icons.LINE_ICONS.settings, icons.ICONS.settings);
  assert.equal(icons.ico("unknown"), icons.ICONS.services);
  assert.equal(icons.ico("pay"), icons.ICONS.pay);
});
