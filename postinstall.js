#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

console.log("🎵 Setting up Claude Notifications...");

// Run the main installer
const installer = spawn(
  "node",
  [path.join(__dirname, "bin", "claude-notifications.js"), "install"],
  {
    stdio: "inherit",
  },
);

installer.on("close", (code) => {
  if (code === 0) {
    console.log("");
    console.log("🎉 Claude Notifications installed successfully!");
    console.log("");
    console.log("Usage:");
    console.log(
      "  claude-notify                # Trigger notification manually",
    );
    console.log("  claude-notifications test    # Test the notification");
    console.log("");
    console.log(
      "Claude Code will now beckon you back with a soothing scale! 🎮✨",
    );
  } else {
    console.error("❌ Installation failed");
    process.exit(code);
  }
});
