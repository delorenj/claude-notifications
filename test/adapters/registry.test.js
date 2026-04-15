"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MARKER_SOURCE,
  makeMarker,
  upsertByMarker,
  removeByMarker,
  writeJson,
  getAdapters,
  getAdapter,
} = require("../../lib/adapters");
const { createFakeFs } = require("../helpers/fake-fs");

test("makeMarker embeds source and version", () => {
  const m = makeMarker({ foo: "bar" });
  assert.equal(m.source, MARKER_SOURCE);
  assert.ok(m.version);
  assert.equal(m.foo, "bar");
});

test("upsertByMarker appends when no marker is present", () => {
  const arr = [{ source: "other", matcher: "" }];
  const entry = makeMarker({ matcher: "", hooks: [] });
  const res = upsertByMarker(arr, entry);
  assert.equal(res.changed, true);
  assert.equal(res.alreadyInstalled, false);
  assert.equal(arr.length, 2);
  assert.equal(arr[1].source, MARKER_SOURCE);
});

test("upsertByMarker is idempotent when entry is identical", () => {
  const entry = makeMarker({ matcher: "", hooks: [{ type: "command", command: "x" }] });
  const arr = [JSON.parse(JSON.stringify(entry))];
  const res = upsertByMarker(arr, entry);
  assert.equal(res.changed, false);
  assert.equal(res.alreadyInstalled, true);
  assert.equal(arr.length, 1);
});

test("upsertByMarker replaces when the marker entry differs", () => {
  const arr = [makeMarker({ matcher: "", hooks: [{ type: "command", command: "old" }] })];
  const entry = makeMarker({ matcher: "", hooks: [{ type: "command", command: "new" }] });
  const res = upsertByMarker(arr, entry);
  assert.equal(res.changed, true);
  assert.equal(arr.length, 1);
  assert.equal(arr[0].hooks[0].command, "new");
});

test("upsertByMarker rejects entries without our marker", () => {
  assert.throws(() => upsertByMarker([], { source: "not-ours" }));
});

test("removeByMarker strips only our entries", () => {
  const arr = [
    { source: "other", matcher: "" },
    makeMarker({ matcher: "" }),
    makeMarker({ matcher: "" }),
    { source: "another", matcher: "" },
  ];
  const res = removeByMarker(arr);
  assert.equal(res.changed, true);
  assert.equal(res.removed, 2);
  assert.equal(arr.length, 2);
  assert.ok(arr.every((e) => e.source !== MARKER_SOURCE));
});

test("writeJson commits through an atomic rename", () => {
  const fs = createFakeFs();
  const serialized = writeJson("/tmp/config/settings.json", { hello: "world" }, { deps: { fs } });
  const files = fs._dump();

  assert.equal(fs.readFileSync("/tmp/config/settings.json"), serialized);
  assert.deepEqual(JSON.parse(files["/tmp/config/settings.json"]), { hello: "world" });
  assert.ok(!Object.keys(files).some((p) => p.includes(".tmp-")));
});

test("registry exposes all expected adapters", () => {
  const ids = getAdapters().map((a) => a.id).sort();
  assert.deepEqual(ids, [
    "auggie", "claude-code", "codex", "copilot",
    "gemini", "kimi", "opencode", "vibe",
  ]);
});

test("getAdapter returns null for unknown id", () => {
  assert.equal(getAdapter("nonexistent"), null);
});
