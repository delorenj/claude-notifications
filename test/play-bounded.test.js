"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { playBounded, LINUX_PLAYERS } = require("../bin/claude-notify.js");

function fakePlayer(dir, name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return file;
}

function sandbox(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "play-bounded-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("SoX play is never a fallback", () => {
  assert.ok(!LINUX_PLAYERS.includes("play"));
  assert.deepEqual(LINUX_PLAYERS.slice(0, 1), ["pw-play"]);
});

test("first working player wins and later ones never run", () =>
  sandbox((dir) => {
    const marker = path.join(dir, "second-ran");
    const good = fakePlayer(dir, "good", "exit 0");
    const second = fakePlayer(dir, "second", `touch ${marker}`);
    assert.equal(playBounded("x.wav", [good, second]), true);
    assert.equal(fs.existsSync(marker), false);
  }));

test("missing or failing players fall through to the next one", () =>
  sandbox((dir) => {
    const bad = fakePlayer(dir, "bad", "exit 3");
    const good = fakePlayer(dir, "good", "exit 0");
    assert.equal(playBounded("x.wav", [path.join(dir, "absent"), bad, good]), true);
  }));

test("a wedged player is SIGKILLed on time and stops the chain", () =>
  sandbox((dir) => {
    const pidfile = path.join(dir, "pid");
    const marker = path.join(dir, "next-ran");
    // exec so the recorded pid is the process spawnSync kills.
    const hang = fakePlayer(dir, "hang", `echo $$ > ${pidfile}\nexec sleep 30`);
    const next = fakePlayer(dir, "next", `touch ${marker}`);
    const started = Date.now();
    assert.equal(playBounded("x.wav", [hang, next], { perPlayerMs: 300, totalMs: 2000 }), false);
    assert.ok(Date.now() - started < 1500, "returned within the bound");
    assert.equal(fs.existsSync(marker), false, "a timeout must not try fallbacks");
    const pid = Number(fs.readFileSync(pidfile, "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, "player is dead");
  }));

test("nothing playable returns false without throwing", () =>
  sandbox((dir) => {
    assert.equal(playBounded("x.wav", [path.join(dir, "absent")]), false);
  }));
