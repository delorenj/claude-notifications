"use strict";

// Opencode's hook surface has not yet been verified for safe config writes.
// Detection is real so the TUI can still show presence; flip `supportsHooks`
// to true in this file once the hook API is confirmed and implemented here.

const { createStubAdapter } = require("./_stub");

module.exports = createStubAdapter({
  id: "opencode",
  label: "Opencode",
  binary: "opencode",
  reason: "hook API not yet verified for this installer",
});
