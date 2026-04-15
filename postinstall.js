#!/usr/bin/env node

// Intentionally minimal: we no longer auto-write agent CLI hooks during
// `npm install`. Hook installation is an explicit, user-initiated step via
// `claude-notifications install`. This avoids surprise writes to
// ~/.claude/settings.json (and other CLI configs) every time the package is
// (re)installed.

const { spawn } = require("child_process");
const path = require("path");

console.log("🎵 Claude Notifications installed.");
console.log("");
console.log("Preparing sound assets...");

// Still generate sound files during npm install — that's a self-contained
// asset under ~/.config/claude-notifications/ and causes no side effects
// outside this package's own config dir.
const soundsOnly = spawn(
  "node",
  [path.join(__dirname, "bin", "claude-notifications.js"), "sounds"],
  { stdio: "inherit" },
);

soundsOnly.on("close", () => {
  console.log("");
  console.log("Next step — wire notification hooks into your agent CLIs:");
  console.log("");
  console.log("  claude-notifications install");
  console.log("");
  console.log("This opens an interactive selector. For scripted installs:");
  console.log("");
  console.log("  claude-notifications install --non-interactive --cli=claude-code");
  console.log("");
});
