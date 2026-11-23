#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { getConfig, getSoundPath, SOUND_TYPES } = require("../lib/config");

const config = getConfig();

// Check for command line arguments
const args = process.argv.slice(2);
const useBell = args.includes("--bell") || args.includes("-b");
const showConfig = args.includes("-c") || args.includes("--config");
// Every player is bounded. SoX `play` through pipewire-alsa can hang in drain
// (futex_do_wait) forever, holding an uncorked sink-input that keeps the sink
// RUNNING; as a fallback it leaked processes for days. So: no SoX, no shell,
// and each player is SIGKILLed by Node itself when it overruns. The bell is
// ~1.6s, so a player still alive at AUDIO_PLAYER_TIMEOUT_MS is wedged.
const AUDIO_PLAYER_TIMEOUT_MS = 3000;
const AUDIO_TOTAL_BUDGET_MS = 4000;
const LINUX_PLAYERS = ["pw-play", "paplay", "aplay"];

/**
 * Play a sound file with the first player that works, never waiting longer than
 * the total budget. Returns true if a player exited 0. A player that times out
 * stops the chain: a wedged audio server would wedge the fallbacks too.
 */
function playBounded(soundFile, players = LINUX_PLAYERS, opts = {}) {
  const perPlayer = opts.perPlayerMs || AUDIO_PLAYER_TIMEOUT_MS;
  const deadline = Date.now() + (opts.totalMs || AUDIO_TOTAL_BUDGET_MS);
  for (const player of players) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    const r = spawnSync(player, [soundFile], {
      stdio: "ignore",
      timeout: Math.min(perPlayer, remaining),
      killSignal: "SIGKILL",
    });
    if (r.status === 0) return true;
    if (r.error && r.error.code === "ETIMEDOUT") return false;
    // ENOENT or non-zero exit: try the next player.
  }
  return false;
}

function playSound() {
  if (!config.sound) {
    return;
  }

  // Determine which sound to play
  let soundType = config.soundType;
  if (useBell) {
    soundType = SOUND_TYPES.BELL;
  }

  const soundFile = getSoundPath(soundType);

  if (!fs.existsSync(soundFile)) {
    console.warn(`Sound file not found: ${soundFile}`);
    process.stdout.write("\x07"); // Fallback to system beep
    return;
  }

  try {
    let played = false;
    if (process.platform === "linux") {
      played = playBounded(soundFile);
    } else if (process.platform === "darwin") {
      played = playBounded(soundFile, ["afplay"]);
    }
    if (!played) process.stdout.write("\x07");
  } catch (error) {
    process.stdout.write("\x07");
  }
}

function showNotification() {
  const notifier = require("node-notifier");

  notifier.notify({
    title: "Claude Code",
    message: "Waiting for you...",
    icon: path.join(os.homedir(), "Pictures", "claude.png"),
    sound: false,
    urgency: "critical",
    id: "claude-code-notification",
    replaceId: "claude-code-notification",
  });
}

function showConfigInfo() {
  const configPath = path.join(
    os.homedir(),
    ".config",
    "claude-notifications",
    "settings.json",
  );
  const soundsDir = path.join(
    os.homedir(),
    ".config",
    "claude-notifications",
    "sounds",
  );

  console.log("🔍 Claude Notifications Config Debug Info:");
  console.log("");
  console.log("📁 Config file location:");
  console.log(`   ${configPath}`);
  console.log(`   Exists: ${fs.existsSync(configPath) ? "✅" : "❌"}`);

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, "utf-8");
      console.log("   Content:");
      console.log(
        `   ${configContent
          .split("\n")
          .map((line) => `   ${line}`)
          .join("\n")}`,
      );
    } catch (error) {
      console.log(`   Error reading: ${error.message}`);
    }
  }

  console.log("");
  console.log("🔊 Sounds directory:");
  console.log(`   ${soundsDir}`);
  console.log(`   Exists: ${fs.existsSync(soundsDir) ? "✅" : "❌"}`);

  if (fs.existsSync(soundsDir)) {
    try {
      const soundFiles = fs.readdirSync(soundsDir);
      console.log("   Files:");
      soundFiles.forEach((file) => {
        const filePath = path.join(soundsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } catch (error) {
      console.log(`   Error reading directory: ${error.message}`);
    }
  }

  console.log("");
  console.log("⚙️  Current config values:");
  console.log(`   sound: ${config.sound}`);
  console.log(`   soundType: ${config.soundType}`);
  console.log(`   desktopNotification: ${config.desktopNotification}`);

  console.log("");
  console.log("🎵 Sound file paths:");
  const { SOUND_TYPES, getSoundPath } = require("../lib/config");
  Object.values(SOUND_TYPES).forEach((soundType) => {
    const soundPath = getSoundPath(soundType);
    console.log(`   ${soundType}: ${soundPath}`);
    console.log(`   Exists: ${fs.existsSync(soundPath) ? "✅" : "❌"}`);
  });

  console.log("");
  console.log("🔧 Command line args:");
  console.log(`   useBell: ${useBell}`);
  console.log(`   showConfig: ${showConfig}`);
}

function main() {
  if (showConfig) {
    showConfigInfo();
    return;
  }

  playSound();
  if (config.desktopNotification) {
    showNotification();
  }
}

if (require.main === module) {
  main();
}

module.exports = { playBounded, LINUX_PLAYERS };
