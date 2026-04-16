"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  MARKER_SOURCE,
  resolveBinary,
} = require("./index");

const ID = "opencode";
const LABEL = "OpenCode";
const BINARY = "opencode";
const PLUGIN_FILENAME = "claude-notifications.js";

function configRoot(deps = {}) {
  const env = deps.env || process.env;
  if (env.XDG_CONFIG_HOME) return env.XDG_CONFIG_HOME;
  const homeFn = deps.homedir || os.homedir;
  return path.join(homeFn(), ".config");
}

function pluginDir(deps = {}) {
  return path.join(configRoot(deps), "opencode", "plugins");
}

function configPath(deps = {}) {
  return path.join(pluginDir(deps), PLUGIN_FILENAME);
}

async function detect(deps = {}) {
  const resolved = await resolveBinary(BINARY, deps);
  return { installed: Boolean(resolved), path: resolved || undefined };
}

function buildPluginContent(notifyCommand) {
  const command = JSON.stringify(notifyCommand);
  const source = JSON.stringify(MARKER_SOURCE);

  return `// Managed by claude-notifications. Do not edit by hand.
// Remove with: claude-notifications uninstall --cli=opencode

import { spawn } from "node:child_process";

const CLAUDE_NOTIFICATIONS_MARKER = Object.freeze({
  source: ${source},
  adapter: "opencode",
});
const NOTIFY_COMMAND = ${command};
const EVENT_TYPES = new Set([
  "session.idle",
  "session.error",
  "permission.asked",
]);
const MIN_INTERVAL_MS = 1000;

let lastNotificationAt = 0;

function runNotification() {
  const now = Date.now();
  if (now - lastNotificationAt < MIN_INTERVAL_MS) return;
  lastNotificationAt = now;

  const child = spawn(NOTIFY_COMMAND, {
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {});
  child.unref();
}

export const ClaudeNotifications = async () => ({
  event: async ({ event }) => {
    if (event && EVENT_TYPES.has(event.type)) runNotification();
  },
});

export const source = CLAUDE_NOTIFICATIONS_MARKER.source;
`;
}

function isManagedPlugin(raw) {
  return (
    typeof raw === "string" &&
    raw.includes("CLAUDE_NOTIFICATIONS_MARKER") &&
    raw.includes(`source: ${JSON.stringify(MARKER_SOURCE)}`)
  );
}

function writeTextFile(filePath, content, { dryRun = false, deps = {} } = {}) {
  if (dryRun) return content;
  const fsMod = deps.fs || fs;
  const dir = path.dirname(filePath);
  if (!fsMod.existsSync(dir)) fsMod.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fsMod.writeFileSync(tmpPath, content, "utf8");
  fsMod.renameSync(tmpPath, filePath);
  return content;
}

async function install(ctx = {}) {
  const { notifyCommand = "claude-notify", dryRun = false, deps = {} } = ctx;
  const target = configPath(deps);
  const fsMod = deps.fs || fs;
  const nextContent = buildPluginContent(notifyCommand);

  if (fsMod.existsSync(target)) {
    const existing = fsMod.readFileSync(target, "utf8");
    if (!isManagedPlugin(existing)) {
      return {
        changed: false,
        status: "failed",
        reason: `refusing to overwrite unmanaged plugin at ${target}`,
      };
    }
    if (existing === nextContent) {
      return { changed: false, status: "skipped", alreadyInstalled: true, reason: "up to date" };
    }
  }

  writeTextFile(target, nextContent, { dryRun, deps });
  return {
    changed: true,
    status: "ok",
    alreadyInstalled: false,
    reason: dryRun ? `would write ${target}` : `updated ${target}`,
  };
}

async function uninstall(ctx) {
  const { dryRun = false, deps = {} } = ctx || {};
  const target = configPath(deps);
  const fsMod = deps.fs || fs;

  if (!fsMod.existsSync(target)) {
    return { changed: false, status: "skipped", reason: "no plugin present" };
  }

  const existing = fsMod.readFileSync(target, "utf8");
  if (!isManagedPlugin(existing)) {
    return { changed: false, status: "skipped", reason: "foreign plugin present" };
  }

  if (!dryRun) fsMod.unlinkSync(target);
  return {
    changed: true,
    status: "ok",
    reason: dryRun ? `would remove ${target}` : `removed ${target}`,
  };
}

async function status(ctx) {
  const { deps = {} } = ctx || {};
  const target = configPath(deps);
  const fsMod = deps.fs || fs;

  if (!fsMod.existsSync(target)) {
    return { installed: false, present: false, detail: "no plugin" };
  }

  const existing = fsMod.readFileSync(target, "utf8");
  const installed = isManagedPlugin(existing);
  return {
    installed,
    present: true,
    detail: installed ? "plugin installed" : "foreign plugin present",
  };
}

module.exports = {
  id: ID,
  label: LABEL,
  binary: BINARY,
  supportsHooks: true,
  configPath,
  detect,
  install,
  uninstall,
  status,
  _internal: {
    buildPluginContent,
    configRoot,
    pluginDir,
    isManagedPlugin,
  },
};
