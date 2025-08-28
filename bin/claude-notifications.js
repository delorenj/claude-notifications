#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ensureConfigDirectory, ensureSoundsDirectory, getSoundPath, SOUND_TYPES, soundsDir } = require("../lib/config");

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
  ensureConfigDirectory();
  ensureSoundsDirectory();
  const soundFile = getSoundPath(SOUND_TYPES.HARP);

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

function generateBellSoxCommand(outputFile) {
  // Bell sound parameters - adjust these to customize the bell
  const bellParams = {
    // Base tone generation
    duration: 0.1, // Length of the initial bell strike (seconds)
    frequency: 1600, // Pitch of the bell (Hz) - higher = more "ting", lower = more "dong"

    // Fade envelope
    fadeIn: 0, // Fade in time (seconds) - 0 for immediate attack
    fadeDuration: 0.1, // Total fade duration (seconds)
    fadeOut: 0.05, // Fade out time (seconds) - creates the bell decay

    // Volume
    volume: 0.9, // Master volume (0.0 to 1.0)

    // Echo effect parameters (creates the "ringing" quality)
    echoGain: 0.5, // Overall echo volume (0.0 to 1.0)
    echoDecay: 0.5, // How quickly echoes fade (0.0 to 1.0)

    // Individual echo delays and volumes (milliseconds, volume)
    echo1: { delay: 250, volume: 0.2 }, // First echo - quarter second delay
    echo2: { delay: 500, volume: 0.05 }, // Second echo - half second delay
    echo3: { delay: 750, volume: 0.01 }, // Third echo - three quarter second delay

    // Reverb parameters (adds spatial depth)
    reverb: {
      roomSize: 40, // Room size percentage (0-100) - larger = more spacious
      preDelay: 65, // Pre-delay in ms - time before reverb starts
      reverbTime: 100, // Reverb decay time percentage (0-100)
      wetGain: 100, // Wet signal gain percentage (0-100) - reverb volume
      dryGain: 12, // Dry signal gain percentage (0-100) - original signal volume
      stereoDepth: 0, // Stereo depth (0-100) - 0 = mono, higher = wider stereo
    },
  };

  // Build the sox command with clear parameter mapping
  const command = [
    "sox -n", // Generate from nothing (null input)
    `"${outputFile}"`, // Output file
    `synth ${bellParams.duration} sine ${bellParams.frequency}`, // Generate sine wave
    `fade ${bellParams.fadeIn} ${bellParams.fadeDuration} ${bellParams.fadeOut}`, // Apply fade envelope
    `vol ${bellParams.volume}`, // Set volume
    `echos ${bellParams.echoGain} ${bellParams.echoDecay}`, // Echo effect base settings
    `${bellParams.echo1.delay} ${bellParams.echo1.volume}`, // Echo 1: 250ms delay, 0.2 volume
    `${bellParams.echo2.delay} ${bellParams.echo2.volume}`, // Echo 2: 500ms delay, 0.1 volume
    `${bellParams.echo3.delay} ${bellParams.echo3.volume}`, // Echo 3: 750ms delay, 0.05 volume
    `reverb ${bellParams.reverb.roomSize} ${bellParams.reverb.preDelay}`, // Reverb room & pre-delay
    `${bellParams.reverb.reverbTime} ${bellParams.reverb.wetGain}`, // Reverb time & wet gain
    `${bellParams.reverb.dryGain} ${bellParams.reverb.stereoDepth}`, // Dry gain & stereo depth
  ].join(" ");

  return command;
}

function createBellSoundFile() {
  ensureConfigDirectory();
  ensureSoundsDirectory();
  const soundFile = getSoundPath(SOUND_TYPES.BELL);

  log("blue", "🔔 Generating service desk bell sound...");

  try {
    // Generate the bell sound using our documented sox command builder
    const bellCommand = generateBellSoxCommand(soundFile);
    execSync(bellCommand, { stdio: "ignore", timeout: 5000 });

    log("green", "✅ Bell sound file created successfully!");
    return true;
  } catch (error) {
    log("red", `❌ Error creating bell sound file: ${error.message}`);
    return false;
  }
}

function main() {
  const command = process.argv[2];

  switch (command) {
    case "install":
    case undefined:
      log("blue", "🎵 Installing Claude Notifications...");

      if (createSoundFile() && createBellSoundFile()) {
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

    case "test-bell":
      log("blue", "🔔 Testing bell notification...");
      spawn("node", [path.join(__dirname, "claude-notify.js"), "--bell"], {
        stdio: "inherit",
      });
      break;

    case "uninstall":
      log("blue", "🗑️  Uninstalling Claude Notifications...");

      // Remove sounds directory
      if (fs.existsSync(soundsDir)) {
        fs.rmSync(soundsDir, { recursive: true, force: true });
        log("green", "✅ Removed sounds directory");
      }

      // Clean up old sound files from legacy location
      const { cleanupLegacySoundFiles } = require("../lib/config");
      cleanupLegacySoundFiles();

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
      console.log("  test-bell  Test the bell notification");
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
