import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadBale({ session = true, result = { data: { success: true }, error: null } } = {}) {
  const calls = [];
  const S = { token: session ? "test-token" : null, me: session ? { building_id: 7 } : null, lastBaleError: "old" };
  const sb = { functions: { async invoke(name, options) { calls.push({ name, options }); return result; } } };
  const window = {};
  vm.runInNewContext(fs.readFileSync(new URL("../bale.js", import.meta.url), "utf8"), { window, S, sb, console });
  return { api: window.ModirBale, calls, S };
}

test("exposes a frozen Bale delivery API", () => {
  const { api } = loadBale();
  assert.equal(Object.isFrozen(api), true);
  assert.equal(typeof api.send, "function");
});

test("sends authenticated text and optional image through send-bale", async () => {
  const { api, calls, S } = loadBale();
  assert.equal(await api.send("hello", "base64-image"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "send-bale");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body)), {
    app_token: "test-token", building_id: 7, text: "hello", image: "base64-image"
  });
  assert.equal(S.lastBaleError, "");
});

test("refuses delivery without a valid session", async () => {
  const { api, calls, S } = loadBale({ session: false });
  assert.equal(await api.send("hello"), false);
  assert.equal(calls.length, 0);
  assert.match(S.lastBaleError, /نشست کاربر/);
});

test("preserves delivery errors for callers", async () => {
  const { api, S } = loadBale({ result: { data: { success: false, error: "delivery failed" }, error: null } });
  assert.equal(await api.send("hello"), false);
  assert.equal(S.lastBaleError, "delivery failed");
});
