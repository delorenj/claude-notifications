"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  MARKER_SOURCE,
  makeMarker,
  readJsonSafe,
  upsertByMarker,
} = require("../../lib/adapters");
const ccAdapter = require("../../lib/adapters/claude-code");
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

// --- Patch P6: makeMarker cannot be hijacked by caller-supplied source/version ---

test("makeMarker forces source/version regardless of caller extras", () => {
  const m = makeMarker({ source: "evil", version: "9.9.9", matcher: "" });
  assert.equal(m.source, MARKER_SOURCE);
  assert.notEqual(m.version, "9.9.9");
  assert.equal(m.matcher, "");
});

// --- Patch E1: marker version change alone does not trigger rewrite ---

test("upsertByMarker treats version-only diff as unchanged", () => {
  const old = { source: MARKER_SOURCE, version: "1.0.0", matcher: "", hooks: [{ type: "command", command: "claude-notify" }] };
  const fresh = { source: MARKER_SOURCE, version: "2.0.0", matcher: "", hooks: [{ type: "command", command: "claude-notify" }] };
  const arr = [JSON.parse(JSON.stringify(old))];
  const res = upsertByMarker(arr, fresh);
  assert.equal(res.changed, false);
  assert.equal(res.alreadyInstalled, true);
});

// --- Patch E3: BOM-prefixed JSON is still readable ---

test("readJsonSafe strips UTF-8 BOM before parsing", () => {
  const deps = { fs: createFakeFs({ "/x.json": "\uFEFF{\"a\":1}" }) };
  const parsed = readJsonSafe("/x.json", deps);
  assert.deepEqual(parsed, { a: 1 });
});

// --- Patch E4: root-level array is rejected loudly, not silently mutated ---

test("readJsonSafe throws ENOTOBJECT on root-level array", () => {
  const deps = { fs: createFakeFs({ "/x.json": "[]" }) };
  assert.throws(() => readJsonSafe("/x.json", deps), { code: "ENOTOBJECT" });
});

test("readJsonSafe throws ENOTOBJECT on scalar root", () => {
  const deps = { fs: createFakeFs({ "/x.json": "42" }) };
  assert.throws(() => readJsonSafe("/x.json", deps), { code: "ENOTOBJECT" });
});

// --- Patch B7: modern settings.json wins over legacy config.json when both exist ---

test("claude-code prefers modern settings.json over legacy config.json", async () => {
  const legacy = path.join(HOME, ".claude", "config.json");
  const modern = MODERN;
  const deps = makeDeps({
    [modern]: JSON.stringify({}, null, 2),
    [legacy]: JSON.stringify({ hooks: { Stop: [] } }, null, 2),
  });
  await ccAdapter.install({ notifyCommand: "claude-notify", deps });
  const written = JSON.parse(deps.fs.readFileSync(modern));
  assert.ok(written.hooks.Notification.some((e) => e.source === MARKER_SOURCE));
  // Legacy config should be untouched.
  const legacyAfter = JSON.parse(deps.fs.readFileSync(legacy));
  assert.deepEqual(legacyAfter, { hooks: { Stop: [] } });
});
