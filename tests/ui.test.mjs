import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { buildSync } from "esbuild";
import React, { act } from "react";
const dir = mkdtempSync(join(tmpdir(), "pharmaflow-test-"));
// Use project-local resolution so React is shared with the test renderer.
const output = join(process.cwd(), ".ui-test.cjs");
buildSync({
  entryPoints: ["src/App.jsx"],
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react-dom"],
  outfile: output,
  logLevel: "silent",
  loader: { ".png": "dataurl" },
});
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://demo.local/#dashboard", pretendToBeVisual: true },
);
for (const key of [
  "window",
  "document",
  "localStorage",
  "location",
  "HTMLElement",
  "Event",
  "MouseEvent",
])
  globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const require = createRequire(import.meta.url);
const App = require(output).default;
let root;
function textButton(label) {
  return [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
}
async function click(button) {
  assert.ok(button, "Expected button to exist");
  await act(async () =>
    button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
}
async function mount(hash = "dashboard") {
  if (root) await act(async () => root.unmount());
  localStorage.clear();
  location.hash = hash;
  root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(App)));
}
function state() {
  return JSON.parse(localStorage.getItem("pharmaflow-demo-v1"));
}
test("all navigation pages render without runtime errors", async () => {
  await mount();
  for (const label of [
    "Shopkeepers",
    "Inventory",
    "Orders & delivery",
    "Sales invoices",
    "Collections",
    "Returns & credits",
    "Suppliers",
    "Reports",
    "Settings",
    "Overview",
  ]) {
    await click(
      [...document.querySelectorAll("nav button")].find((b) =>
        b.textContent.includes(label),
      ),
    );
    assert.ok(document.querySelector("h1"));
    assert.ok(document.querySelector("main"));
  }
  assert.match(
    document.querySelector("h1").textContent,
    /Distribution overview/,
  );
});
test("UI creates a draft, approves it, delivers it and shows posted invoice", async () => {
  await mount("orders");
  const before = state().invoices.length;
  await click(textButton("New order"));
  assert.ok(document.querySelector('[role="dialog"]'));
  await click(textButton("Save draft order"));
  const newOrder = state().orders[0];
  assert.equal(newOrder.status, "Draft");
  await click(textButton("Approve"));
  assert.equal(state().orders[0].status, "Approved");
  await click(textButton("Deliver"));
  await click(textButton("Confirm delivery"));
  assert.equal(state().orders[0].status, "Delivered");
  assert.equal(state().invoices.length, before + 1);
  await click(textButton("Invoice"));
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /SALES INVOICE/,
  );
  assert.ok(textButton("Print invoice"));
});
test("modal can close with Escape and selected dashboard filter is preserved", async () => {
  await mount();
  await click(textButton("Record payment"));
  assert.ok(document.querySelector('[role="dialog"]'));
  await act(async () =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await click(textButton("Review invoices"));
  assert.equal(location.hash, "#invoices");
  const filter = document.querySelector(".toolbar select");
  assert.equal(filter.value, "Overdue");
  assert.equal(document.querySelectorAll("tbody tr").length, 2);
});
test("shop statement switches to payment form with that shop selected", async () => {
  await mount("shops");
  await click(textButton("Statement"));
  const name = state().shops[0].name;
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    new RegExp(name),
  );
  await click(textButton("Record payment"));
  const select = document.querySelector('[role="dialog"] select');
  assert.equal(select.value, state().shops[0].id);
  assert.match(
    document.querySelector("#modal-title").textContent,
    /Record a payment/,
  );
});
test("demo changes survive remount through local storage", async () => {
  await mount("orders");
  await click(textButton("Approve"));
  assert.equal(
    state().orders.find((o) => o.id === "ORD-001").status,
    "Approved",
  );
  await act(async () => root.unmount());
  root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(App)));
  assert.match(document.querySelector("tbody").textContent, /Approved/);
});
test.after(async () => {
  if (root) await act(async () => root.unmount());
  dom.window.close();
  rmSync(output, { force: true });
  rmSync(dir, { recursive: true, force: true });
});

test("connected mode routes mutations to the API adapter and does not persist business records locally", async () => {
  const M = await import("../src/lib/model.mjs");
  if (root) await act(async () => root.unmount());
  localStorage.clear();
  location.hash = "orders";
  let serverState = M.createSeed(),
    calls = [];
  const mutation = async (name, args) => {
    calls.push(name);
    serverState = M[name](serverState, ...args);
    return serverState;
  };
  root = createRoot(document.getElementById("root"));
  await act(async () =>
    root.render(
      React.createElement(App, {
        initialState: serverState,
        mode: "api",
        user: { name: "Hamza", role: "admin" },
        onMutation: mutation,
        onLogout: () => {},
      }),
    ),
  );
  assert.match(
    document.querySelector(".live-indicator").textContent,
    /Connected/,
  );
  await click(textButton("New order"));
  await click(textButton("Save draft order"));
  assert.deepEqual(calls, ["createOrder"]);
  assert.equal(localStorage.getItem("pharmaflow-demo-v1"), null);
  await click(textButton("Approve"));
  await click(textButton("Deliver"));
  await click(textButton("Confirm delivery"));
  assert.deepEqual(calls, ["createOrder", "approveOrder", "deliverOrder"]);
  assert.equal(serverState.orders[0].status, "Delivered");
});
test("a connected API rejection leaves displayed records unchanged", async () => {
  const M = await import("../src/lib/model.mjs");
  if (root) await act(async () => root.unmount());
  localStorage.clear();
  location.hash = "orders";
  const initial = M.createSeed();
  root = createRoot(document.getElementById("root"));
  await act(async () =>
    root.render(
      React.createElement(App, {
        initialState: initial,
        mode: "api",
        onMutation: async () => {
          throw Error("Credit limit exceeded by server.");
        },
      }),
    ),
  );
  await click(textButton("Approve"));
  assert.match(
    document.querySelector('[role="status"]').textContent,
    /Credit limit exceeded by server/,
  );
  assert.equal(
    document.querySelectorAll("tbody .badge")[0].textContent,
    "Draft",
  );
  assert.equal(localStorage.getItem("pharmaflow-demo-v1"), null);
});
