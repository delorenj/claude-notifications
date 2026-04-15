"use strict";

const { createStubAdapter } = require("./_stub");

module.exports = createStubAdapter({
  id: "kimi",
  label: "Kimi CLI",
  binary: "kimi",
  reason: "hook API not yet verified for this installer",
});
