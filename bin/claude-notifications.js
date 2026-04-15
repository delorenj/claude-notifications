#!/usr/bin/env node

"use strict";

const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  ensureConfigDirectory,
  ensureSoundsDirectory,
  getSoundPath,
  notifyBinaryPath,
  SOUND_TYPES,
  soundsDir,
} = require("../lib/config");
const { getAdapters, getAdapter, detectAll } = require("../lib/adapters");

const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ---------- Argv parsing (tiny hand-rolled; adding yargs/commander would be
// yet another runtime dep and the flag surface is small) ----------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {
    cli: null,           // comma-separated adapter ids
    dryRun: false,
    keepGoing: false,
    // Default false. Prompts read stdin, not stdout — so the old
    // `!process.stdout.isTTY` default tripped on harmless things like
    // `claude-notifications install | tee log.txt`. We decide at prompt time.
    nonInteractive: false,
    help: false,
    json: false,
  };
  const positional = [];
  for (const arg of rest) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--keep-going") flags.keepGoing = true;
    else if (arg === "--non-interactive" || arg === "-y") flags.nonInteractive = true;
    else if (arg === "--json") flags.json = true;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg.startsWith("--cli=")) flags.cli = arg.slice("--cli=".length);
    else if (arg === "--cli") {
      log("red", "❌ Use --cli=<ids> (no space).");
      process.exitCode = 2;
      throw new CliUsageError("bad --cli form");
    } else if (arg.startsWith("-")) {
      log("red", `❌ Unknown flag: ${arg}`);
      process.exitCode = 2;
      throw new CliUsageError(`unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length > 0) {
    log("red", `❌ Unexpected argument(s): ${positional.join(" ")}`);
    log("blue", 'Run "claude-notifications help" for usage information');
    process.exitCode = 2;
    throw new CliUsageError("unexpected positional args");
  }
  return { command, flags };
}

class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliUsageError";
  }
}

// ---------- Sound asset generation (kept from original, trimmed comments) ----

function soxInstallHint() {
  if (process.platform === "darwin") return "brew install sox";
  if (process.platform === "linux") return "sudo apt install sox";
  return "install sox with your system package manager";
}

function ensureSoxAvailable() {
  try {
    require("which").sync("sox");
    return true;
  } catch (_err) {
    log("yellow", "⚠️  sox not found.");
    log("yellow", `💡 Please install 'sox' manually to enable sound generation: ${soxInstallHint()}`);
    return false;
  }
}

function createSoundFile() {
  ensureConfigDirectory();
  ensureSoundsDirectory();
  const soundFile = getSoundPath(SOUND_TYPES.HARP);

  if (!ensureSoxAvailable()) return false;

  log("blue", "🎼 Generating a pleasant notification scale...");
  let tempDir;
  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-notifications-"));
  } catch (error) {
    log("red", `❌ Cannot create temp directory: ${error.message}`);
    return false;
  }

  const notes = [
    { freq: 523.25 }, { freq: 587.33 }, { freq: 659.25 },
    { freq: 783.99 }, { freq: 1046.5 }, { freq: 1174.66 },
    { freq: 1318.51 }, { freq: 1567.98 }, { freq: 2093.0 },
  ];

  try {
    const noteFiles = [];
    for (let i = 0; i < notes.length; i += 1) {
      const noteFile = path.join(tempDir, `note_${i}.wav`);
      // execFileSync with argv bypasses the shell entirely, so paths/env vars
      // containing quotes or metacharacters cannot inject commands.
      execFileSync(
        "sox",
        ["-n", noteFile, "synth", "0.08", "sine", String(notes[i].freq),
         "fade", "0.01", "0.08", "0.01", "vol", "0.7"],
        { stdio: "ignore", timeout: 5000 },
      );
      noteFiles.push(noteFile);
    }
    execFileSync("sox", [...noteFiles, soundFile], { stdio: "ignore", timeout: 10000 });
    log("green", "✅ Sound file created successfully!");
    return true;
  } catch (error) {
    log("red", `❌ Error creating sound file: ${error.message}`);
    return false;
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function createBellSoundFile() {
  ensureConfigDirectory();
  ensureSoundsDirectory();
  const soundFile = getSoundPath(SOUND_TYPES.BELL);
  if (!ensureSoxAvailable()) return false;
  log("blue", "🔔 Generating service desk bell sound...");
  const argv = [
    "-n", soundFile,
    "synth", "0.1", "sine", "1600",
    "fade", "0", "0.1", "0.05",
    "vol", "0.9",
    "echos", "0.5", "0.5", "250", "0.2", "500", "0.05", "750", "0.01",
    "reverb", "40", "65", "100", "100", "12", "0",
  ];
  try {
    execFileSync("sox", argv, { stdio: "ignore", timeout: 5000 });
    log("green", "✅ Bell sound file created successfully!");
    return true;
  } catch (error) {
    log("red", `❌ Error creating bell sound file: ${error.message}`);
    return false;
  }
}

// ---------- Core orchestration ----------

async function doInstall(flags) {
  const notifyPath = await notifyBinaryPath();
  if (!notifyPath) {
    log("red", "❌ `claude-notify` not found on PATH.");
    log("blue", "   Fix: install this package globally (`npm i -g @delorenj/claude-notifications`) or `npm link` from source.");
    process.exitCode = 1;
    return;
  }

  const detections = await detectAll();

  // Resolve the selection.
  let selectedIds;
  if (flags.cli) {
    const requested = flags.cli.split(",").map((s) => s.trim()).filter(Boolean);
    const validIds = new Set(getAdapters().map((a) => a.id));
    const unknown = requested.filter((id) => !validIds.has(id));
    if (unknown.length > 0) {
      log("red", `❌ Unknown CLI id(s): ${unknown.join(", ")}`);
      log("blue", `   Known: ${[...validIds].join(", ")}`);
      process.exitCode = 2;
      return;
    }
    selectedIds = requested;
  } else if (flags.nonInteractive) {
    log("red", "❌ --non-interactive requires --cli=<ids>.");
    process.exitCode = 2;
    return;
  } else if (!process.stdin.isTTY) {
    // No explicit --non-interactive, but we genuinely cannot prompt without
    // a stdin TTY. Tell the user what to do instead of crashing inside clack.
    log("red", "❌ No interactive stdin detected.");
    log("blue", "   Pass --cli=<ids> to select non-interactively, or run in a terminal.");
    process.exitCode = 2;
    return;
  } else {
    const { renderSelector } = require("../lib/tui");
    const result = await renderSelector(detections);
    if (result.cancelled) {
      process.exitCode = 130;
      return;
    }
    selectedIds = result.selectedIds;
  }

  if (selectedIds.length === 0) {
    log("yellow", "Nothing selected. No hooks installed.");
    return;
  }

  const results = [];
  for (const id of selectedIds) {
    const adapter = getAdapter(id);
    if (!adapter) {
      results.push({ id, changed: false, status: "failed", reason: "unknown adapter" });
      continue;
    }
    if (!adapter.supportsHooks) {
      results.push({
        id, changed: false,
        status: "skipped",
        reason: adapter.unsupportedReason || "unsupported",
      });
      continue;
    }
    try {
      const res = await adapter.install({
        notifyCommand: "claude-notify",
        dryRun: flags.dryRun,
      });
      results.push({ id, ...res });
    } catch (err) {
      results.push({ id, changed: false, status: "failed", reason: err.message });
      if (!flags.keepGoing) break;
    }
  }

  reportResults(results, flags, "install");
}

async function doUninstall(flags) {
  const detections = await detectAll();
  const hookCapableIds = detections
    .filter(({ adapter }) => adapter.supportsHooks)
    .map(({ adapter }) => adapter.id);

  let selectedIds;
  if (flags.cli) {
    selectedIds = flags.cli.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (flags.nonInteractive || !process.stdin.isTTY) {
    // No CLI specified + no prompt possible: default to every supported
    // adapter. This is the path `preuninstall.js` takes during `npm uninstall`.
    selectedIds = detections
      .filter(({ adapter }) => adapter.supportsHooks)
      .map(({ adapter }) => adapter.id);
  } else {
    const { renderSelector } = require("../lib/tui");
    const result = await renderSelector(detections);
    if (result.cancelled) {
      process.exitCode = 130;
      return;
    }
    selectedIds = result.selectedIds;
  }

  const selectedSet = new Set(selectedIds);
  const fullUninstall =
    !flags.cli &&
    hookCapableIds.length > 0 &&
    hookCapableIds.every((id) => selectedSet.has(id));

  // Uninstall is best-effort cleanup: a malformed config on ONE CLI must not
  // orphan hooks on the others. Always keep going here regardless of flag.
  const results = [];
  for (const id of selectedIds) {
    const adapter = getAdapter(id);
    if (!adapter) {
      results.push({ id, changed: false, status: "failed", reason: "unknown adapter" });
      continue;
    }
    if (!adapter.supportsHooks) {
      results.push({
        id,
        changed: false,
        status: "skipped",
        reason: adapter.unsupportedReason || "unsupported",
      });
      continue;
    }
    try {
      const res = await adapter.uninstall({ dryRun: flags.dryRun });
      results.push({ id, ...res });
    } catch (err) {
      results.push({ id, changed: false, status: "failed", reason: err.message });
    }
  }

  // Only scrub the shared sounds directory on a FULL uninstall. Partial
  // uninstalls (--cli=X) must leave sounds alone because other CLI hooks
  // may still reference them.
  if (fullUninstall) {
    if (fs.existsSync(soundsDir)) {
      if (!flags.dryRun) fs.rmSync(soundsDir, { recursive: true, force: true });
      const reason = `${flags.dryRun ? "would remove" : "removed"} sounds directory`;
      if (flags.json) {
        results.push({ id: "shared-sounds", changed: true, status: "ok", reason });
      } else {
        log("green", `✅ ${reason}`);
      }
    }
    try {
      const { cleanupLegacySoundFiles } = require("../lib/config");
      const cleanedCount = flags.dryRun
        ? 0
        : cleanupLegacySoundFiles({ quiet: flags.json });
      if (flags.json && cleanedCount > 0) {
        results.push({
          id: "legacy-sounds",
          changed: true,
          status: "ok",
          reason: `cleaned ${cleanedCount} legacy sound file(s)`,
        });
      }
    } catch (_e) { /* optional */ }
  }

  reportResults(results, flags, "uninstall");
}

async function doStatus(flags) {
  const detections = await detectAll();
  const rows = [];
  for (const { adapter, detection } of detections) {
    let statusDetail = "—";
    if (detection.installed && adapter.supportsHooks) {
      try {
        const s = await adapter.status({});
        statusDetail = s.detail || (s.installed ? "installed" : "absent");
      } catch (err) {
        statusDetail = `error: ${err.message}`;
      }
    } else if (!detection.installed) {
      statusDetail = "CLI not on PATH";
    } else {
      statusDetail = adapter.unsupportedReason || "unsupported";
    }
    rows.push({
      id: adapter.id,
      label: adapter.label,
      detected: Boolean(detection.installed),
      supportsHooks: adapter.supportsHooks,
      detail: statusDetail,
    });
  }

  if (flags.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  log("blue", "Agent CLI status:");
  console.log("");
  console.log(`  ${pad("ID", 14)}${pad("LABEL", 24)}${pad("DETECTED", 10)}${pad("HOOKS", 8)}DETAIL`);
  console.log(`  ${"─".repeat(72)}`);
  for (const r of rows) {
    console.log(
      `  ${pad(r.id, 14)}${pad(r.label, 24)}${pad(r.detected ? "yes" : "no", 10)}${pad(r.supportsHooks ? "yes" : "no", 8)}${r.detail}`,
    );
  }
}

function reportResults(results, flags, verb) {
  let ok = 0; let skipped = 0; let failed = 0;
  const touched = []; // ids that actually changed (for the `installed:` line)
  for (const r of results) {
    const status = r.status || (r.changed ? "ok" : "skipped");
    if (status === "failed") {
      if (!flags.json) log("red", `  ✗ ${r.id}: ${r.reason || "failed"}`);
      failed += 1;
    } else if (r.changed) {
      if (!flags.json) log("green", `  ✓ ${r.id}: ${r.reason || "done"}`);
      touched.push(r.id);
      ok += 1;
    } else if (r.alreadyInstalled) {
      if (!flags.json) log("dim", `  · ${r.id}: already installed`);
      skipped += 1;
    } else {
      if (!flags.json) log("dim", `  · ${r.id}: ${r.reason || "no change"}`);
      skipped += 1;
    }
  }
  const summary = { changed: ok, skipped, failed, dryRun: Boolean(flags.dryRun) };
  if (flags.json) {
    console.log(JSON.stringify({ [verb]: results, summary }, null, 2));
    if (failed > 0) process.exitCode = 2;
    return;
  }
  console.log("");
  log("blue", `Summary: ${ok} changed, ${skipped} skipped, ${failed} failed${flags.dryRun ? " (dry-run)" : ""}`);
  // Emit a parseable line for CI/scripting consumers. Always present so
  // stdout is grep-friendly regardless of whether any adapter changed.
  const verbWord = verb === "install" ? "installed" : verb === "uninstall" ? "uninstalled" : verb;
  console.log(`${verbWord}: [${touched.join(", ")}]`);
  // Non-zero exit on failure regardless of --keep-going: keep-going controls
  // iteration, not exit semantics. CI should always see failures as failures.
  if (failed > 0) process.exitCode = 2;
}

// ---------- Help ----------

function printHelp() {
  console.log(`Notifications for Claude Code and other agent CLIs.

Usage:
  claude-notifications <command> [flags]

Commands:
  install              Select CLIs via TUI and install notification hooks.
  uninstall            Remove hook blocks tagged by this package.
  status [--json]      Show detected CLIs and their hook status.
  sounds               (Re)generate sound assets under ~/.config/claude-notifications/.
  test                 Trigger the notification manually.
  test-bell            Trigger the bell notification.
  help                 Show this help.

Flags:
  --cli=<ids>          Comma-separated adapter ids (skip TUI).
  --non-interactive    Never prompt. Requires --cli on install.
  --dry-run            Print what would change without writing.
  --keep-going         Continue past adapter errors.
  --json               Machine-readable output for status/install/uninstall.
  -h, --help

Known adapter ids:
  ${getAdapters().map((a) => a.id).join(", ")}
`);
}

// ---------- Entry ----------

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof CliUsageError) return; // exitCode already set
    throw err;
  }
  const { command, flags } = parsed;

  if (flags.help || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "install":
    case undefined:
      await doInstall(flags);
      return;
    case "uninstall":
      await doUninstall(flags);
      return;
    case "status":
      await doStatus(flags);
      return;
    case "sounds": {
      const a = createSoundFile();
      const b = createBellSoundFile();
      if (!a && !b) process.exitCode = 1;
      return;
    }
    case "test":
      spawn("node", [path.join(__dirname, "claude-notify.js")], { stdio: "inherit" });
      return;
    case "test-bell":
      spawn("node", [path.join(__dirname, "claude-notify.js"), "--bell"], { stdio: "inherit" });
      return;
    default:
      log("red", `❌ Unknown command: ${command}`);
      log("blue", 'Run "claude-notifications help" for usage information');
      process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    log("red", `❌ ${err.stack || err.message || err}`);
    // Use exitCode + natural drain instead of process.exit so any pending
    // async I/O (file writes, stdout flush) completes before Node exits.
    process.exitCode = 1;
  });
}
