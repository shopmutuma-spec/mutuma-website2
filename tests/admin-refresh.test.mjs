import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const status = { textContent: "" };
const panel = { hidden: true, addEventListener() {}, querySelector: () => status };
const form = { hidden: false, addEventListener() {} };
let user = null;
let requests = 0;
let respond = async () => ({ generatedAt: "2026-09-14T12:00:00Z" });
const context = vm.createContext({
    console, URLSearchParams, Intl, Date, Object, Number, String,
    initBaseLayout() {}, initCurrency: async () => {},
    getCurrentUser: async () => user,
    adminFetch: async () => { requests++; return respond(); },
    document: { querySelector: (selector) => ({
        "[data-admin-login]": form, "[data-admin-panel]": panel,
        "[data-admin-message]": status, ".admin-layout": { classList: { add() {}, remove() {} } }
    })[selector] },
    window: { addEventListener() {} }, setInterval() {}
});
const source = readFileSync("js/admin.js", "utf8").replace(/^import .*;\r?\n/gm, "");
vm.runInContext(source, context);
await new Promise((resolve) => setImmediate(resolve));
vm.runInContext("renderAdmin = () => {}; maybeLoadRouteData = () => {};", context);
user = { email: "admin@example.com" };
await vm.runInContext("loadAdmin()", context);
assert.equal(panel.hidden, false);
assert.equal(requests, 1);
vm.runInContext("dirty = true", context);
await vm.runInContext("loadAdmin({ silent: true })", context);
assert.equal(requests, 1, "An edit must prevent refresh");
vm.runInContext("dirty = false; saving = true", context);
await vm.runInContext("loadAdmin({ silent: true })", context);
assert.equal(requests, 1, "A save must prevent refresh");
vm.runInContext("saving = false", context);
let finish;
respond = () => new Promise((resolve) => { finish = resolve; });
const pending = vm.runInContext("loadAdmin({ silent: true })", context);
await new Promise((resolve) => setImmediate(resolve));
vm.runInContext("dirty = true", context);
finish({ generatedAt: "new" });
await pending;
assert.notEqual(vm.runInContext("adminData.generatedAt", context), "new", "In-flight refresh must not overwrite newly started edits");
vm.runInContext("dirty = false", context);
respond = async () => { throw new Error("Network unavailable"); };
await vm.runInContext("loadAdmin({ silent: true })", context);
assert.equal(panel.hidden, false);
assert.match(status.textContent, /previously loaded/);
respond = async () => { throw new Error("Admin access only."); };
await vm.runInContext("loadAdmin({ silent: true })", context);
assert.equal(panel.hidden, true);
assert.equal(vm.runInContext("adminData", context), null);
console.log("Admin refresh protects edits, pending saves, in-flight edits and access denial.");
