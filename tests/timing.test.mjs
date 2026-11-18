import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync(new URL("../timing.js", import.meta.url), "utf8"), {
  window, Object, setTimeout, clearTimeout
});

test("exposes a frozen debounce API", () => {
  assert.equal(Object.isFrozen(window.ModirTiming), true);
  assert.equal(typeof window.ModirTiming.debounce, "function");
});

test("debounce runs once with the most recent arguments", async () => {
  const calls = [];
  const run = window.ModirTiming.debounce((value) => calls.push(value), 15);
  run("first");
  run("second");
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(calls, ["second"]);
});
