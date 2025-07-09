#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function playSound() {
  const soundFile = path.join(os.homedir(), '.local', 'share', 'sounds', 'claude-notification.wav');
  
  if (!fs.existsSync(soundFile)) {
    // Fallback to system bell
    process.stdout.write('\x07');
    return;
  }

  try {
    // Try different audio players based on platform
    if (process.platform === 'linux') {
      // Try paplay first (PulseAudio)
      try {
        execSync(`paplay "${soundFile}"`, { stdio: 'ignore' });
        return;
      } catch (e) {
        // Try aplay (ALSA)
        try {
          execSync(`aplay "${soundFile}"`, { stdio: 'ignore' });
          return;
        } catch (e2) {
          // Try play (sox)
          try {
            execSync(`play "${soundFile}"`, { stdio: 'ignore' });
            return;
          } catch (e3) {
            // Fallback to system bell
            process.stdout.write('\x07');
          }
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS
      try {
        execSync(`afplay "${soundFile}"`, { stdio: 'ignore' });
        return;
      } catch (e) {
        // Fallback to system bell
        process.stdout.write('\x07');
      }
    } else {
      // Other platforms - just system bell
      process.stdout.write('\x07');
    }
  } catch (error) {
    // Final fallback
    process.stdout.write('\x07');
  }
}

function showNotification() {
  const notifier = require('node-notifier');
  
  notifier.notify({
    title: 'Claude Code',
    message: 'Waiting for you...',
    icon: path.join(os.homedir(), 'Pictures', 'claude.png'), // Will fallback gracefully if not found
    sound: false, // We handle sound separately
    urgency: 'critical'
  });
}

function main() {
  // Play sound in background
  playSound();
  
  // Show desktop notification
  showNotification();
}

if (require.main === module) {
  main();
}
