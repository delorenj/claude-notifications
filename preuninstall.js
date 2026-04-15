#!/usr/bin/env node

// Route through the adapter-aware uninstall so hook blocks we installed
// get cleanly removed from every CLI config we've ever touched.

const { spawn } = require("child_process");
const path = require("path");

console.log("🗑️  Cleaning up Claude Notifications...");

const uninstaller = spawn(
  process.execPath,
  [path.join(__dirname, "bin", "claude-notifications.js"), "uninstall", "--non-interactive"],
  { stdio: "inherit" },
);

uninstaller.on("close", (code) => {
  if (code !== 0) {
    console.error(`Warning: uninstall exited with code ${code}`);
    process.exitCode = code;
    return;
  }
  console.log("👋 Thanks for using Claude Notifications!");
});
