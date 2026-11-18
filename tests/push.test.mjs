import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadPush() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(new URL("../push.js", import.meta.url), "utf8"), {
    window, S: { token: null }, Object
  });
  return window.ModirPush;
}

test("exposes a frozen push API with explicit lifecycle methods", () => {
  const push = loadPush();
  assert.equal(Object.isFrozen(push), true);
  for (const method of ["getServiceWorker", "enable", "detachSubscription", "maybeAskForPermission", "send"]) {
    assert.equal(typeof push[method], "function", method + " must be available");
  }
});

test("does not send or detach push subscriptions without an authenticated session", async () => {
  const push = loadPush();
  assert.equal(await push.send("event", "title", "body"), null);
  assert.equal(await push.detachSubscription(null), undefined);
  assert.equal(push.maybeAskForPermission(), undefined);
});

test("requires a session before enabling mobile push", async () => {
  const push = loadPush();
  await assert.rejects(push.enable(), /ابتدا وارد حساب شوید/);
});
