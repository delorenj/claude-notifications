"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const adapter = require("../../lib/adapters/opencode");
const { MARKER_SOURCE } = require("../../lib/adapters");
const { createFakeFs } = require("../helpers/fake-fs");

const HOME = "/home/tester";
const PLUGIN = path.join(HOME, ".config", "opencode", "plugins", "claude-notifications.js");

function makeDeps(files = {}, extra = {}) {
  return {
    fs: createFakeFs(files),
    homedir: () => HOME,
    which: async () => `${HOME}/.local/bin/opencode`,
    ...extra,
  };
}

test("detect returns installed true when which resolves", async () => {
  const d = await adapter.detect(makeDeps());
  assert.equal(d.installed, true);
});

test("detect returns installed false when which returns null", async () => {
  const d = await adapter.detect({ which: async () => null });
  assert.equal(d.installed, false);
});

test("configPath respects XDG_CONFIG_HOME", () => {
  const p = adapter.configPath({
    env: { XDG_CONFIG_HOME: "/xdg" },
    homedir: () => HOME,
  });
  assert.equal(p, path.join("/xdg", "opencode", "plugins", "claude-notifications.js"));
});

test("install writes a managed global OpenCode plugin", async () => {
  const deps = makeDeps();
  const res = await adapter.install({
    notifyCommand: "claude-notify",
    dryRun: false,
    deps,
  });

  assert.equal(res.changed, true);
  assert.equal(res.status, "ok");

  const written = deps.fs.readFileSync(PLUGIN);
  assert.match(written, /Managed by claude-notifications/);
  assert.match(written, new RegExp(`source: "${MARKER_SOURCE}"`));
  assert.match(written, /"session\.idle"/);
  assert.match(written, /"permission\.asked"/);
  assert.match(written, /spawn\(NOTIFY_COMMAND/);
});

test("install is idempotent on re-run", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });
  const before = deps.fs.readFileSync(PLUGIN);
  const res = await adapter.install({ notifyCommand: "claude-notify", deps });
  const after = deps.fs.readFileSync(PLUGIN);

  assert.equal(res.changed, false);
  assert.equal(res.alreadyInstalled, true);
  assert.equal(before, after);
});

test("install dry-run reports the target without writing", async () => {
  const deps = makeDeps();
  const res = await adapter.install({
    notifyCommand: "claude-notify",
    dryRun: true,
    deps,
  });

  assert.equal(res.changed, true);
  assert.match(res.reason, /would write/);
  assert.equal(deps.fs.existsSync(PLUGIN), false);
});

test("install refuses to overwrite an unmanaged plugin file", async () => {
  const deps = makeDeps({ [PLUGIN]: "export const Mine = async () => ({})\n" });
  const res = await adapter.install({ notifyCommand: "claude-notify", deps });

  assert.equal(res.changed, false);
  assert.equal(res.status, "failed");
  assert.match(res.reason, /refusing to overwrite unmanaged plugin/);
  assert.equal(deps.fs.readFileSync(PLUGIN), "export const Mine = async () => ({})\n");
});

test("uninstall removes only the managed plugin", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });

  const res = await adapter.uninstall({ deps });

  assert.equal(res.changed, true);
  assert.equal(res.status, "ok");
  assert.equal(deps.fs.existsSync(PLUGIN), false);
});

test("uninstall skips unmanaged plugin files", async () => {
  const deps = makeDeps({ [PLUGIN]: "export const Mine = async () => ({})\n" });
  const res = await adapter.uninstall({ deps });

  assert.equal(res.changed, false);
  assert.equal(res.status, "skipped");
  assert.match(res.reason, /foreign plugin/);
  assert.equal(deps.fs.existsSync(PLUGIN), true);
});

test("status reports installed when marker is present", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });

  const s = await adapter.status({ deps });

  assert.equal(s.installed, true);
  assert.equal(s.present, true);
  assert.equal(s.detail, "plugin installed");
});

test("status distinguishes missing and foreign plugin files", async () => {
  const missingDeps = makeDeps();
  const missing = await adapter.status({ deps: missingDeps });
  assert.equal(missing.installed, false);
  assert.equal(missing.present, false);

  const foreignDeps = makeDeps({ [PLUGIN]: "export const Mine = async () => ({})\n" });
  const foreign = await adapter.status({ deps: foreignDeps });
  assert.equal(foreign.installed, false);
  assert.equal(foreign.present, true);
  assert.equal(foreign.detail, "foreign plugin present");
});
