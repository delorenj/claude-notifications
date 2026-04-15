"use strict";

const { createStubAdapter } = require("./_stub");

module.exports = createStubAdapter({
  id: "gemini",
  label: "Gemini CLI",
  binary: "gemini",
  reason: "no public hook API",
});
