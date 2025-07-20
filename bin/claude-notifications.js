#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function findClaudeCodeConfig() {
  // Common Claude Code config locations
  const possiblePaths = [
    path.join(os.homedir(), ".claude", "config.json"),
    path.join(os.homedir(), ".config", "claude", "config.json"),
    path.join(os.homedir(), ".claude-code", "config.json"),
    path.join(os.homedir(), ".config", "claude-code", "config.json"),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

function updateClaudeCodeConfig() {
  const configPath = findClaudeCodeConfig();

  if (!configPath) {
    log("yellow", "⚠️  Could not find Claude Code config file.");
    log(
      "blue",
      "💡 Please manually add the stop hook to your Claude Code settings:",
    );
    console.log(
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: "",
                hooks: [
                  {
                    type: "command",
                    command: "claude-notify",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    let config = {};
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(configContent);
    }

    // Add or update hooks
    if (!config.hooks) config.hooks = {};
    if (!config.hooks.Stop) config.hooks.Stop = [];

    // Check if our hook already exists
    const existingHook = config.hooks.Stop.find(
      (hook) =>
        hook.hooks && hook.hooks.some((h) => h.command === "claude-notify"),
    );

    if (!existingHook) {
      config.hooks.Stop.push({
        matcher: "",
        hooks: [
          {
            type: "command",
            command: "claude-notify",
          },
        ],
      });

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      log("green", "✅ Added stop hook to Claude Code config!");
    } else {
      log("blue", "📝 Stop hook already exists in Claude Code config");
    }
  } catch (error) {
    log("red", `❌ Error updating Claude Code config: ${error.message}`);
  }
}

function createSoundFile() {
  const soundDir = path.join(os.homedir(), ".local", "share", "sounds");
  const soundFile = path.join(soundDir, "claude-notification.wav");

  // Create directory if it doesn't exist
  if (!fs.existsSync(soundDir)) {
    fs.mkdirSync(soundDir, { recursive: true });
  }

  // Check if sox is available
  try {
    execSync("which sox", { stdio: "ignore" });
  } catch (error) {
    log("yellow", "⚠️  sox not found. Installing...");
    try {
      if (process.platform === "linux") {
        execSync("sudo apt update && sudo apt install -y sox", {
          stdio: "inherit",
        });
      } else if (process.platform === "darwin") {
        execSync("brew install sox", { stdio: "inherit" });
      }
    } catch (installError) {
      log("red", "❌ Could not install sox. Please install it manually.");
      return false;
    }
  }

  // Generate pleasant notification scale
  log("blue", "🎼 Generating a pleasant notification scale...");

  // Create individual note files first (safer approach)
  const tempDir = path.join(os.tmpdir(), "claude-notifications");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const notes = [
    { freq: 523.25, name: "C5" }, // C5
    { freq: 587.33, name: "D5" }, // D5
    { freq: 659.25, name: "E5" }, // E5
    { freq: 783.99, name: "G5" }, // G5
    { freq: 1046.5, name: "C6" }, // C6
    { freq: 1174.66, name: "D6" }, // D6
    { freq: 1318.51, name: "E6" }, // E6
    { freq: 1567.98, name: "G6" }, // G6
    { freq: 2093.0, name: "C7" }, // C7
  ];

  try {
    const noteFiles = [];

    // Generate each note individually (much safer)
    for (let i = 0; i < notes.length; i++) {
      const noteFile = path.join(tempDir, `note_${i}.wav`);
      const noteCommand = `sox -n "${noteFile}" synth 0.08 sine ${notes[i].freq} fade 0.01 0.08 0.01 vol 0.7`;
      execSync(noteCommand, { stdio: "ignore", timeout: 5000 }); // 5 second timeout per note
      noteFiles.push(noteFile);
    }

    // Concatenate all notes into final file
    const concatCommand = `sox ${noteFiles.map((f) => `"${f}"`).join(" ")} "${soundFile}"`;
    execSync(concatCommand, { stdio: "ignore", timeout: 10000 }); // 10 second timeout for concat

    // Clean up temp files
    noteFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Remove temp directory if empty
    try {
      fs.rmdirSync(tempDir);
    } catch (e) {
      // Directory might not be empty, that's ok
    }

    log("green", "✅ Sound file created successfully!");
    return true;
  } catch (error) {
    log("red", `❌ Error creating sound file: ${error.message}`);

    // Clean up any temp files on error
    try {
      const tempFiles = fs
        .readdirSync(tempDir)
        .filter((f) => f.startsWith("note_"));
      tempFiles.forEach((file) => {
        const filePath = path.join(tempDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
}

function main() {
  const command = process.argv[2];

  switch (command) {
    case "install":
    case undefined:
      log("blue", "🎵 Installing Claude Notifications...");

      if (createSoundFile()) {
        updateClaudeCodeConfig();
        log("green", "🎉 Installation complete!");
        log("blue", "🧪 Testing notification...");

        // Test the notification
        const testProcess = spawn(
          "node",
          [path.join(__dirname, "claude-notify.js")],
          {
            stdio: "inherit",
          },
        );

        testProcess.on("close", () => {
          log(
            "green",
            "✅ Test complete! You should have heard a dreamy notification!",
          );
          console.log("");
          log("blue", "Usage:");
          console.log(
            "  claude-notify          # Trigger notification manually",
          );
          console.log("  claude-notifications   # This installer");
          console.log("");
          log(
            "blue",
            "Claude Code will now beckon you back with a pleasant notification when it finishes responses or is waiting for your input! 🎮",
          );
        });
      }
      break;

    case "test":
      log("blue", "🧪 Testing notification...");
      spawn("node", [path.join(__dirname, "claude-notify.js")], {
        stdio: "inherit",
      });
      break;

    case "uninstall":
      log("blue", "🗑️  Uninstalling Claude Notifications...");

      const soundFile = path.join(
        os.homedir(),
        ".local",
        "share",
        "sounds",
        "claude-notification.wav",
      );
      if (fs.existsSync(soundFile)) {
        fs.unlinkSync(soundFile);
        log("green", "✅ Removed sound file");
      }

      log(
        "yellow",
        "⚠️  Please manually remove the stop hook from your Claude Code config",
      );
      log("green", "🎉 Uninstallation complete!");
      break;

    case "help":
    case "--help":
    case "-h":
      console.log("Notifications for Claude Code");
      console.log("");
      console.log("Usage:");
      console.log("  claude-notifications [command]");
      console.log("");
      console.log("Commands:");
      console.log("  install    Install notifications (default)");
      console.log("  test       Test the notification");
      console.log("  uninstall  Remove notifications");
      console.log("  help       Show this help");
      break;

    default:
      log("red", `❌ Unknown command: ${command}`);
      log("blue", 'Run "claude-notifications help" for usage information');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}
