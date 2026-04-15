"use strict";

const { createStubAdapter } = require("./_stub");

module.exports = createStubAdapter({
  id: "codex",
  label: "OpenAI Codex CLI",
  binary: "codex",
  reason: "hook API not yet verified for this installer",
});
