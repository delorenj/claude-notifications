"use strict";

const { resolveBinary } = require("./index");

/**
 * Factory for adapters whose hook surface has not been verified.
 * Detection is real (so the TUI can show them), but install/uninstall
 * are inert and return an `unsupported` reason.
 */
function createStubAdapter({ id, label, binary, reason }) {
  async function detect(deps = {}) {
    const resolved = await resolveBinary(binary, deps);
    return { installed: Boolean(resolved), path: resolved || undefined };
  }
  async function unsupportedOp() {
    return { changed: false, status: "skipped", reason };
  }
  async function status() {
    return { installed: false, present: false, detail: reason };
  }
  return {
    id,
    label,
    binary,
    supportsHooks: false,
    unsupportedReason: reason,
    configPath: () => null,
    detect,
    install: unsupportedOp,
    uninstall: unsupportedOp,
    status,
  };
}

module.exports = { createStubAdapter };
