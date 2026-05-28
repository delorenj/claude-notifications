"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const CLI_SOURCE = fs.readFileSync(path.join(ROOT, "bin", "claude-notify.js"), "utf8");

function createRequestRecorder() {
  const calls = [];

  function request(url, options) {
    const handlers = new Map();
    const req = {
      destroyedWith: null,
      ended: false,
      timeoutHandler: null,
      timeoutMs: null,
      written: [],
      destroy(error) {
        this.destroyedWith = error || null;
        if (error) this.emit("error", error);
        this.emit("close");
      },
      emit(event, ...args) {
        const eventHandlers = handlers.get(event) || [];
        for (const handler of eventHandlers) handler(...args);
      },
      end() {
        this.ended = true;
      },
      on(event, handler) {
        const eventHandlers = handlers.get(event) || [];
        eventHandlers.push(handler);
        handlers.set(event, eventHandlers);
        return this;
      },
      setTimeout(ms, handler) {
        this.timeoutMs = ms;
        this.timeoutHandler = handler;
        return this;
      },
      write(data) {
        this.written.push(data);
      }
    };

    calls.push({ url, options, req });
    return req;
  }

  return { calls, request };
}

function createTimerHarness() {
  const timers = [];

  return {
    timers,
    clearTimeout(timer) {
      timer.cleared = true;
    },
    setTimeout(callback, ms) {
      const timer = {
        callback,
        cleared: false,
        ms,
        unrefCalled: false,
        unref() {
          this.unrefCalled = true;
        }
      };
      timers.push(timer);
      return timer;
    }
  };
}

function loadWebhookHarness(webhookConfig) {
  const errors = [];
  const httpRecorder = createRequestRecorder();
  const httpsRecorder = createRequestRecorder();
  const timerHarness = createTimerHarness();
  const module = { exports: {} };
  const config = {
    desktopNotification: false,
    sound: false,
    webhook: {
      enabled: true,
      url: "http://example.test/hook",
      ...webhookConfig
    },
    zellijVisualization: { enabled: false }
  };

  const context = {
    Buffer,
    __dirname: path.join(ROOT, "bin"),
    clearTimeout: timerHarness.clearTimeout,
    console: {
      error: (...args) => errors.push(args.join(" ")),
      log: () => {},
      warn: () => {}
    },
    module,
    process: {
      argv: [process.execPath, path.join(ROOT, "bin", "claude-notify.js")],
      env: {},
      platform: process.platform,
      stdout: { write: () => {} }
    },
    require(specifier) {
      if (specifier === "child_process") return { execSync: () => {} };
      if (specifier === "fs") return require("node:fs");
      if (specifier === "path") return require("node:path");
      if (specifier === "os") return require("node:os");
      if (specifier === "http") return { request: httpRecorder.request };
      if (specifier === "https") return { request: httpsRecorder.request };
      if (specifier === "../lib/config") {
        return {
          getConfig: () => config,
          getSoundPath: () => "/tmp/claude-notification.wav",
          SOUND_TYPES: { BELL: "bell", HARP: "harp" }
        };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    setTimeout: timerHarness.setTimeout
  };
  context.require.main = {};

  vm.runInNewContext(
    `${CLI_SOURCE}\nmodule.exports.__test = { triggerWebhook };`,
    context,
    { filename: "bin/claude-notify.js" }
  );

  return {
    errors,
    httpRecorder,
    httpsRecorder,
    timers: timerHarness.timers,
    triggerWebhook: module.exports.__test.triggerWebhook
  };
}

test("triggerWebhook keeps legacy JSON payload and applies configured timeout", () => {
  const harness = loadWebhookHarness({ timeoutMs: 2345 });

  harness.triggerWebhook();

  assert.equal(harness.httpRecorder.calls.length, 1);
  const { options, req, url } = harness.httpRecorder.calls[0];
  assert.equal(url, "http://example.test/hook");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(req.written[0], JSON.stringify({ message: "Claude is waiting for you..." }));
  assert.equal(options.headers["Content-Length"], Buffer.byteLength(req.written[0]));
  assert.equal(req.timeoutMs, 2345);
  assert.equal(harness.timers[0].ms, 2345);
  assert.equal(harness.timers[0].unrefCalled, true);
  assert.equal(req.ended, true);
  assert.deepEqual(harness.errors, []);
});

test("triggerWebhook sends ntfy format as plain text with configured headers", () => {
  const harness = loadWebhookHarness({
    body: "Plain ntfy body",
    format: "ntfy",
    headers: {
      Priority: "high",
      Title: "Claude Code"
    },
    url: "https://ntfy.example.test/claude"
  });

  harness.triggerWebhook();

  assert.equal(harness.httpsRecorder.calls.length, 1);
  const { options, req, url } = harness.httpsRecorder.calls[0];
  assert.equal(url, "https://ntfy.example.test/claude");
  assert.equal(options.headers["Content-Type"], "text/plain; charset=utf-8");
  assert.equal(options.headers.Title, "Claude Code");
  assert.equal(options.headers.Priority, "high");
  assert.equal(req.written[0].toString("utf8"), "Plain ntfy body");
  assert.equal(options.headers["Content-Length"], Buffer.byteLength("Plain ntfy body"));
});

test("triggerWebhook aborts timed out requests and logs concise errors", () => {
  const harness = loadWebhookHarness({});

  harness.triggerWebhook();
  harness.timers[0].callback();

  const { req } = harness.httpRecorder.calls[0];
  assert.equal(req.destroyedWith.code, "ETIMEDOUT");
  assert.equal(req.destroyedWith.message, "timed out after 1500ms");
  assert.deepEqual(harness.errors, [
    "Error triggering webhook: timed out after 1500ms"
  ]);
});

test("triggerWebhook handles network errors without stack traces", () => {
  const harness = loadWebhookHarness({});

  harness.triggerWebhook();
  const error = new Error("connect ECONNREFUSED 127.0.0.1");
  error.code = "ECONNREFUSED";
  harness.httpRecorder.calls[0].req.emit("error", error);

  assert.deepEqual(harness.errors, [
    "Error triggering webhook: ECONNREFUSED: connect ECONNREFUSED 127.0.0.1"
  ]);
});
