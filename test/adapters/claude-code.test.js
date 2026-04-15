"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const adapter = require("../../lib/adapters/claude-code");
const { MARKER_SOURCE } = require("../../lib/adapters");
const { createFakeFs } = require("../helpers/fake-fs");

const HOME = "/home/tester";
const MODERN = path.join(HOME, ".claude", "settings.json");

function makeDeps(files = {}) {
  return {
    fs: createFakeFs(files),
    homedir: () => HOME,
    which: async () => `${HOME}/.local/bin/claude`,
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

test("install writes a Notification + Stop hook tagged with our marker", async () => {
  const deps = makeDeps();
  const res = await adapter.install({
    notifyCommand: "claude-notify",
    dryRun: false,
    deps,
  });
  assert.equal(res.changed, true);
  const written = JSON.parse(deps.fs.readFileSync(MODERN));
  for (const event of ["Notification", "Stop"]) {
    assert.ok(Array.isArray(written.hooks[event]));
    const ours = written.hooks[event].find((e) => e.source === MARKER_SOURCE);
    assert.ok(ours, `${event} should contain our marker`);
    assert.equal(ours.hooks[0].command, "claude-notify");
  }
});

test("install is idempotent on re-run", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });
  const before = deps.fs.readFileSync(MODERN);
  const res = await adapter.install({ notifyCommand: "claude-notify", deps });
  assert.equal(res.changed, false);
  assert.equal(res.alreadyInstalled, true);
  const after = deps.fs.readFileSync(MODERN);
  assert.equal(before, after);
});

test("install preserves foreign hook entries", async () => {
  const existing = {
    hooks: {
      Notification: [{ matcher: "", hooks: [{ type: "command", command: "other-tool" }] }],
    },
    otherSetting: "kept",
  };
  const deps = makeDeps({ [MODERN]: JSON.stringify(existing, null, 2) });
  await adapter.install({ notifyCommand: "claude-notify", deps });
  const written = JSON.parse(deps.fs.readFileSync(MODERN));
  assert.equal(written.otherSetting, "kept");
  assert.equal(written.hooks.Notification.length, 2);
  assert.equal(written.hooks.Notification[0].hooks[0].command, "other-tool");
});

test("uninstall removes only our marked entries", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });
  // Add an unrelated hook.
  const cfg = JSON.parse(deps.fs.readFileSync(MODERN));
  cfg.hooks.Notification.unshift({
    matcher: "",
    hooks: [{ type: "command", command: "other-tool" }],
  });
  deps.fs.writeFileSync(MODERN, JSON.stringify(cfg, null, 2));
  const res = await adapter.uninstall({ deps });
  assert.equal(res.changed, true);
  const after = JSON.parse(deps.fs.readFileSync(MODERN));
  const remaining = after.hooks.Notification.filter((e) => e.source === MARKER_SOURCE);
  assert.equal(remaining.length, 0);
  assert.equal(after.hooks.Notification.length, 1);
  assert.equal(after.hooks.Notification[0].hooks[0].command, "other-tool");
});

test("uninstall with no config is a no-op", async () => {
  const deps = makeDeps();
  const res = await adapter.uninstall({ deps });
  assert.equal(res.changed, false);
});

test("dry-run install does not write to disk", async () => {
  const deps = makeDeps();
  const res = await adapter.install({
    notifyCommand: "claude-notify",
    dryRun: true,
    deps,
  });
  assert.equal(res.changed, true);
  assert.equal(deps.fs.existsSync(MODERN), false);
});

test("status reports installed when marker is present", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });
  const s = await adapter.status({ deps });
  assert.equal(s.installed, true);
  assert.equal(s.present, true);
});

test("status handles missing config", async () => {
  const deps = makeDeps();
  const s = await adapter.status({ deps });
  assert.equal(s.installed, false);
  assert.equal(s.present, false);
});

test("install handles malformed JSON gracefully", async () => {
  const deps = makeDeps({ [MODERN]: "{ not valid json" });
  const res = await adapter.install({ notifyCommand: "claude-notify", deps });
  assert.equal(res.changed, false);
  assert.match(res.reason, /not valid JSON/);
});

test("install falls back to modern path when no config exists", async () => {
  const deps = makeDeps();
  await adapter.install({ notifyCommand: "claude-notify", deps });
  assert.ok(deps.fs.existsSync(MODERN), "modern settings.json should be created");
});

test("install updates existing legacy config.json in place", async () => {
  const legacyPath = path.join(HOME, ".claude", "config.json");
  const deps = makeDeps({ [legacyPath]: JSON.stringify({}, null, 2) });
  await adapter.install({ notifyCommand: "claude-notify", deps });
  assert.ok(deps.fs.existsSync(legacyPath));
  assert.equal(deps.fs.existsSync(MODERN), false);
});
