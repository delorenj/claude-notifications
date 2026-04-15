"use strict";

/**
 * Adapter registry + shared helpers for installing notification hooks
 * into agent CLIs.
 *
 * Adapter interface (duck-typed):
 *   id:                string        stable identifier, e.g. "claude-code"
 *   label:             string        display name, e.g. "Claude Code"
 *   binary:            string        executable name probed on $PATH
 *   supportsHooks:     boolean       whether install/uninstall actually writes
 *   unsupportedReason: string?       populated when supportsHooks === false
 *   detect(deps):      Promise<{installed, path?}>
 *   configPath():      string                            absolute file path
 *   install(ctx):      Promise<OpResult>
 *   uninstall(ctx):    Promise<OpResult>
 *   status(ctx):       Promise<StatusResult>
 *
 * OpResult:     { changed: boolean, status?: "ok" | "skipped" | "failed", alreadyInstalled?: boolean, reason?: string, diff?: string }
 * StatusResult: { installed: boolean, present: boolean, detail?: string }
 * ctx:          { notifyCommand, dryRun, pkgVersion, log, deps }
 */

const fs = require("fs");
const path = require("path");

// `which` exposes an async variant; fall back to a small Promise wrapper if the
// module version shape ever changes.
let whichLib;
try {
  whichLib = require("which");
} catch (err) {
  whichLib = null;
}

const MARKER_SOURCE = "claude-notifications";

/** Package version used in every marker we write. Cached on first read. */
let cachedPkgVersion = null;
function pkgVersion() {
  if (cachedPkgVersion) return cachedPkgVersion;
  try {
    // eslint-disable-next-line global-require
    cachedPkgVersion = require("../../package.json").version || "0.0.0";
  } catch (_err) {
    cachedPkgVersion = "0.0.0";
  }
  return cachedPkgVersion;
}

/**
 * Resolve a binary on $PATH. Returns the absolute path or null.
 * `deps.which` can be swapped for tests.
 */
async function resolveBinary(name, deps = {}) {
  const whichFn = deps.which || whichLib;
  if (!whichFn) return null;
  try {
    // `which` v4 exposes an async function as the default export; older
    // versions expose a callback form on `.sync` / a promise on the default.
    if (typeof whichFn === "function") {
      const result = await whichFn(name, { nothrow: true });
      return result || null;
    }
    if (typeof whichFn.sync === "function") {
      return whichFn.sync(name, { nothrow: true }) || null;
    }
  } catch (_err) {
    return null;
  }
  return null;
}

/**
 * Read JSON from disk. Returns `{}` when the file is missing or empty.
 * Strips a leading BOM so files edited by tools that emit one (Notepad etc.)
 * are still readable. If the JSON parses to something other than a plain
 * object (we only ever upsert hooks into an object-shaped config), throws an
 * `ENOTOBJECT` error. Any parse error bubbles up so the adapter can decide
 * whether to abort or repair.
 */
function readJsonSafe(filePath, deps = {}) {
  const fsMod = deps.fs || fs;
  if (!fsMod.existsSync(filePath)) return {};
  let raw = fsMod.readFileSync(filePath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    const err = new Error(
      "expected JSON object at top level, got " +
        (Array.isArray(parsed) ? "array" : typeof parsed),
    );
    err.code = "ENOTOBJECT";
    throw err;
  }
  return parsed;
}

/**
 * Atomic JSON write via temp-file-then-rename. Ensures the parent dir exists.
 * Respects `dryRun` — returns the serialized string without touching disk.
 *
 * The rename is atomic on POSIX (same filesystem), so an interrupted write
 * cannot truncate the target config.
 */
function writeJson(filePath, obj, { dryRun = false, deps = {} } = {}) {
  const fsMod = deps.fs || fs;
  const serialized = JSON.stringify(obj, null, 2) + "\n";
  if (dryRun) return serialized;
  const dir = path.dirname(filePath);
  if (!fsMod.existsSync(dir)) fsMod.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fsMod.writeFileSync(tmpPath, serialized);
  fsMod.renameSync(tmpPath, filePath);
  return serialized;
}

/**
 * Marker-based upsert into an array at `config[<...path>]`.
 *
 * Finds the first element whose `source === MARKER_SOURCE` and replaces it in
 * place; otherwise appends. Returns { changed, alreadyInstalled }.
 *
 * `newEntry` must already contain `{ source, version }` fields so idempotency
 * comparisons work post-read.
 */
function upsertByMarker(array, newEntry) {
  if (!Array.isArray(array)) {
    throw new TypeError("upsertByMarker expected an array");
  }
  if (!newEntry || newEntry.source !== MARKER_SOURCE) {
    throw new TypeError(
      `upsertByMarker requires newEntry.source === "${MARKER_SOURCE}"`,
    );
  }
  const idx = array.findIndex((el) => el && el.source === MARKER_SOURCE);
  if (idx === -1) {
    array.push(newEntry);
    return { changed: true, alreadyInstalled: false };
  }
  // Compare structurally — but exclude `version` so a package upgrade that
  // changes nothing else doesn't trigger a write-storm across every managed
  // config. We still refresh the stored version in-place on next functional
  // change.
  const withoutVersion = (o) => {
    const { version, ...rest } = o || {};
    return rest;
  };
  const existingJson = JSON.stringify(withoutVersion(array[idx]));
  const newJson = JSON.stringify(withoutVersion(newEntry));
  if (existingJson === newJson) {
    return { changed: false, alreadyInstalled: true };
  }
  array[idx] = newEntry;
  return { changed: true, alreadyInstalled: false };
}

/**
 * Remove every element tagged with our marker. Returns { changed, removed }.
 */
function removeByMarker(array) {
  if (!Array.isArray(array)) return { changed: false, removed: 0 };
  const before = array.length;
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (array[i] && array[i].source === MARKER_SOURCE) array.splice(i, 1);
  }
  const removed = before - array.length;
  return { changed: removed > 0, removed };
}

/**
 * Build a marker object for embedding in adapter-specific config shapes.
 */
function makeMarker(extra = {}) {
  // Spread extras first, then force-set source/version last so no caller can
  // accidentally overwrite the fields the marker protocol depends on.
  return {
    ...extra,
    source: MARKER_SOURCE,
    version: pkgVersion(),
  };
}

// ---------- Registry ----------

const adapterFactories = [
  () => require("./claude-code"),
  () => require("./opencode"),
  () => require("./gemini"),
  () => require("./auggie"),
  () => require("./copilot"),
  () => require("./kimi"),
  () => require("./vibe"),
  () => require("./codex"),
];

let cachedAdapters = null;
function getAdapters() {
  if (cachedAdapters) return cachedAdapters;
  cachedAdapters = adapterFactories.map((factory) => factory());
  return cachedAdapters;
}

function getAdapter(id) {
  return getAdapters().find((a) => a.id === id) || null;
}

/**
 * Probe every adapter in parallel and return an array of `{ adapter, detection }`.
 */
async function detectAll(deps = {}) {
  const adapters = getAdapters();
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      let detection = { installed: false };
      try {
        detection = await adapter.detect(deps);
      } catch (err) {
        detection = { installed: false, error: err.message };
      }
      return { adapter, detection };
    }),
  );
  return results;
}

module.exports = {
  MARKER_SOURCE,
  makeMarker,
  pkgVersion,
  resolveBinary,
  readJsonSafe,
  writeJson,
  upsertByMarker,
  removeByMarker,
  getAdapters,
  getAdapter,
  detectAll,
};
