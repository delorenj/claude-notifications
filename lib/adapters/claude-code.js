"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  MARKER_SOURCE,
  makeMarker,
  readJsonSafe,
  writeJson,
  upsertByMarker,
  removeByMarker,
  resolveBinary,
} = require("./index");

const ID = "claude-code";
const LABEL = "Claude Code";
const BINARY = "claude";

// Modern Claude Code reads hooks from ~/.claude/settings.json.
// Older installs may have ~/.claude/config.json; we only fall back to it if
// the modern file is entirely absent, otherwise we'd silently write into a
// stale file that the live Claude Code never reads.
function candidateConfigPaths(deps = {}) {
  const homeFn = deps.homedir || os.homedir;
  const home = homeFn();
  return [
    path.join(home, ".claude", "settings.json"),        // modern (preferred)
    path.join(home, ".config", "claude", "settings.json"),
    path.join(home, ".claude", "config.json"),          // legacy
    path.join(home, ".config", "claude", "config.json"),
  ];
}

/**
 * Return the modern path whenever ANY modern candidate exists, or no config
 * exists at all (so a fresh install creates a well-known file). Only fall
 * through to legacy paths when only legacy paths exist.
 */
function configPath(deps = {}) {
  const fsMod = deps.fs || fs;
  const candidates = candidateConfigPaths(deps);
  const modern = [candidates[0], candidates[1]];
  const legacy = [candidates[2], candidates[3]];
  for (const p of modern) {
    if (fsMod.existsSync(p)) return p;
  }
  for (const p of legacy) {
    if (fsMod.existsSync(p)) return p;
  }
  return candidates[0];
}

async function detect(deps = {}) {
  const resolved = await resolveBinary(BINARY, deps);
  return { installed: Boolean(resolved), path: resolved || undefined };
}

/**
 * Build the hook entry we own in the Claude Code config. The entry embeds a
 * marker so we can locate it later without matching on command strings.
 *
 * We install hooks on two events:
 *   - Notification: fires when Claude Code requests user attention
 *   - Stop:         fires when the agent finishes its turn (back-compat)
 */
function buildHookEntry(notifyCommand) {
  return makeMarker({
    matcher: "",
    hooks: [{ type: "command", command: notifyCommand }],
  });
}

function mutateConfig(config, notifyCommand, op) {
  // Ensure structural keys exist without stomping unrelated config.
  if (!config.hooks || typeof config.hooks !== "object") config.hooks = {};
  const events = ["Notification", "Stop"];
  const results = events.map((event) => {
    if (!Array.isArray(config.hooks[event])) config.hooks[event] = [];
    if (op === "install") {
      return upsertByMarker(config.hooks[event], buildHookEntry(notifyCommand));
    }
    return removeByMarker(config.hooks[event]);
  });
  // Collapse N event results into a single changed/alreadyInstalled summary.
  const changed = results.some((r) => r.changed);
  const alreadyInstalled =
    op === "install" && results.every((r) => r.alreadyInstalled);
  return { changed, alreadyInstalled, events: results };
}

async function install(ctx) {
  const { notifyCommand, dryRun = false, deps = {} } = ctx;
  const target = configPath(deps);
  let config;
  try {
    config = readJsonSafe(target, deps);
  } catch (err) {
    return {
      changed: false,
      status: "failed",
      reason: `config at ${target} is not valid JSON: ${err.message}`,
    };
  }
  const summary = mutateConfig(config, notifyCommand, "install");
  if (!summary.changed) {
    return { changed: false, status: "skipped", alreadyInstalled: true, reason: "up to date" };
  }
  writeJson(target, config, { dryRun, deps });
  return {
    changed: true,
    status: "ok",
    alreadyInstalled: false,
    reason: dryRun ? `would write ${target}` : `updated ${target}`,
  };
}

async function uninstall(ctx) {
  const { dryRun = false, deps = {} } = ctx;
  const target = configPath(deps);
  const fsMod = deps.fs || fs;
  if (!fsMod.existsSync(target)) {
    return { changed: false, status: "skipped", reason: "no config present" };
  }
  let config;
  try {
    config = readJsonSafe(target, deps);
  } catch (err) {
    return { changed: false, status: "failed", reason: `invalid JSON at ${target}: ${err.message}` };
  }
  const summary = mutateConfig(config, "", "uninstall");
  if (!summary.changed) {
    return { changed: false, status: "skipped", reason: "nothing to remove" };
  }
  writeJson(target, config, { dryRun, deps });
  return {
    changed: true,
    status: "ok",
    reason: dryRun ? `would update ${target}` : `cleaned ${target}`,
  };
}

async function status(ctx) {
  const { deps = {} } = ctx || {};
  const target = configPath(deps);
  const fsMod = deps.fs || fs;
  if (!fsMod.existsSync(target)) {
    return { installed: false, present: false, detail: "no config" };
  }
  let config;
  try {
    config = readJsonSafe(target, deps);
  } catch (err) {
    return { installed: false, present: true, detail: `invalid JSON: ${err.message}` };
  }
  const events = ["Notification", "Stop"];
  const present = events.some(
    (e) =>
      Array.isArray(config.hooks && config.hooks[e]) &&
      config.hooks[e].some((x) => x && x.source === MARKER_SOURCE),
  );
  return {
    installed: present,
    present: true,
    detail: present ? "hook installed" : "hook absent",
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
  // exported for tests
  _internal: { buildHookEntry, mutateConfig, candidateConfigPaths },
};
