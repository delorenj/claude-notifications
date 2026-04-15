"use strict";

const { createStubAdapter } = require("./_stub");

module.exports = createStubAdapter({
  id: "copilot",
  label: "GitHub Copilot CLI",
  binary: "copilot",
  reason: "no public hook API",
});
