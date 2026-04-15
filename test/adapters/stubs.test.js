"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getAdapter, getAdapters } = require("../../lib/adapters");

const UNSUPPORTED_IDS = ["opencode", "gemini", "auggie", "copilot", "kimi", "vibe", "codex"];

for (const id of UNSUPPORTED_IDS) {
  test(`stub adapter "${id}" has supportsHooks=false and a reason`, () => {
    const a = getAdapter(id);
    assert.ok(a, `${id} should be registered`);
    assert.equal(a.supportsHooks, false);
    assert.ok(
      typeof a.unsupportedReason === "string" && a.unsupportedReason.length > 0,
      "unsupportedReason should be a non-empty string",
    );
  });

  test(`stub adapter "${id}" install is inert`, async () => {
    const a = getAdapter(id);
    const res = await a.install({});
    assert.equal(res.changed, false);
    assert.ok(res.reason);
  });

  test(`stub adapter "${id}" detect resolves without error`, async () => {
    const a = getAdapter(id);
    // Force which to return null so detection is deterministic in CI without CLIs.
    const res = await a.detect({ which: async () => null });
    assert.equal(res.installed, false);
  });
}

test("every adapter has the required interface shape", () => {
  for (const a of getAdapters()) {
    assert.ok(typeof a.id === "string");
    assert.ok(typeof a.label === "string");
    assert.ok(typeof a.binary === "string");
    assert.ok(typeof a.detect === "function");
    assert.ok(typeof a.install === "function");
    assert.ok(typeof a.uninstall === "function");
    assert.ok(typeof a.status === "function");
    assert.equal(typeof a.supportsHooks, "boolean");
  }
});
