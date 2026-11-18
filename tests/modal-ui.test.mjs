import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadModal() {
  const appended = [];
  const historyCalls = [];
  const history = {
    state: {},
    pushState(state, title, url) { this.state = state; historyCalls.push({ type: "push", state, url }); },
    back() { historyCalls.push({ type: "back" }); }
  };
  const document = {
    createElement() {
      return {
        className: "", innerHTML: "", isConnected: true,
        addEventListener() {},
        remove() { this.isConnected = false; }
      };
    },
    body: { appendChild(element) { appended.push(element); } }
  };
  const window = {};
  vm.runInNewContext(fs.readFileSync(new URL("../modal-ui.js", import.meta.url), "utf8"), {
    window, document, history, S: { view: "dash" }, Object
  });
  return { api: window.ModirModal, appended, history, historyCalls };
}

test("exposes a frozen explicit modal API", () => {
  const { api } = loadModal();
  assert.equal(Object.isFrozen(api), true);
  assert.equal(typeof api.open, "function");
  assert.equal(typeof api.close, "function");
});

test("opens a modal and records the current view in browser history", () => {
  const { api, appended, historyCalls } = loadModal();
  const modal = api.open("<p>test</p>");
  assert.equal(appended.length, 1);
  assert.equal(appended[0], modal);
  assert.equal(modal.className, "modal-bg");
  assert.equal(historyCalls[0].type, "push");
  assert.equal(historyCalls[0].state.view, "dash");
  assert.equal(historyCalls[0].url, "#modal");
});

test("closes through browser history when modal state is active", () => {
  const { api, history, historyCalls } = loadModal();
  const modal = api.open("test");
  api.close(modal);
  assert.equal(historyCalls.at(-1).type, "back");
  assert.equal(modal.isConnected, true);
  history.state = {};
});

test("removes a modal directly when there is no modal history entry", () => {
  const { api } = loadModal();
  const modal = api.open("test");
  modal.isConnected = true;
  api.close(modal);
  assert.equal(modal.isConnected, false);
});
