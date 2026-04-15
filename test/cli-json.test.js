"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "bin", "claude-notifications.js");

function makeCliEnv() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "claude-notifications-cli-"));
  const binDir = path.join(home, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.symlinkSync(path.join(ROOT, "bin", "claude-notify.js"), path.join(binDir, "claude-notify"));

  return {
    home,
    env: {
      ...process.env,
      HOME: home,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
    },
  };
}

function runCli(args, prepare) {
  const ctx = makeCliEnv();
  try {
    if (prepare) prepare(ctx.home);
    return spawnSync(process.execPath, [CLI, ...args], {
      env: ctx.env,
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(ctx.home, { recursive: true, force: true });
  }
}

test("install --json preserves failure exit status", () => {
  const result = runCli(["install", "--non-interactive", "--cli=claude-code", "--json"], (home) => {
    const claudeDir = path.join(home, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "settings.json"), "[]");
  });

  assert.equal(result.status, 2);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.failed, 1);
  assert.equal(payload.install[0].id, "claude-code");
  assert.equal(payload.install[0].status, "failed");
  assert.match(payload.install[0].reason, /expected JSON object/);
});

test("install --json emits clean JSON on success", () => {
  const result = runCli(["install", "--non-interactive", "--cli=claude-code", "--json"]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.changed, 1);
  assert.equal(payload.summary.failed, 0);
  assert.equal(payload.install[0].id, "claude-code");
  assert.equal(payload.install[0].status, "ok");
});

test("uninstall --json keeps shared cleanup inside JSON payload", () => {
  const result = runCli(["uninstall", "--non-interactive", "--json"], (home) => {
    const soundsDir = path.join(home, ".config", "claude-notifications", "sounds");
    fs.mkdirSync(soundsDir, { recursive: true });
    fs.writeFileSync(path.join(soundsDir, "claude-notification.wav"), "");
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.failed, 0);
  assert.ok(payload.uninstall.some((entry) => entry.id === "shared-sounds"));
});
