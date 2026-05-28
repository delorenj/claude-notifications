#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig, getSoundPath, SOUND_TYPES } = require('../lib/config');

const config = getConfig();

// Check for command line arguments
const args = process.argv.slice(2);
const useBell = args.includes('--bell') || args.includes('-b');
const showConfig = args.includes('-c') || args.includes('--config');
const AUDIO_COMMAND_TIMEOUT_MS = 800;

function execAudioCommand(command) {
  execSync(command, {
    stdio: 'ignore',
    timeout: AUDIO_COMMAND_TIMEOUT_MS
  });
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
    process.stdout.write('\x07'); // Fallback to system beep
    return;
  }

  try {
    if (process.platform === 'linux') {
      try {
        // Fix for PipeWire/PulseAudio suspended audio sinks
        // Play sound twice: first play wakes up the sink, second actually produces audio
        execAudioCommand(`paplay "${soundFile}" 2>/dev/null || true`);
        execAudioCommand(`paplay "${soundFile}"`);
      } catch (e) {
        try {
          execAudioCommand(`aplay "${soundFile}"`);
        } catch (e2) {
          try {
            execAudioCommand(`play "${soundFile}"`);
          } catch (e3) {
            process.stdout.write('\x07');
          }
        }
      }
    } else if (process.platform === 'darwin') {
      try {
        execAudioCommand(`afplay "${soundFile}"`);
      } catch (e) {
        process.stdout.write('\x07');
      }
    } else {
      process.stdout.write('\x07');
    }
  } catch (error) {
    process.stdout.write('\x07');
  }
}

function showNotification() {
  const notifier = require('node-notifier');

  notifier.notify({
    title: 'Claude Code',
    message: 'Waiting for you...',
    icon: path.join(os.homedir(), 'Pictures', 'claude.png'),
    sound: false,
    urgency: 'critical',
    id: 'claude-code-notification',
    replaceId: 'claude-code-notification'
  });
}

function showConfigInfo() {
  const configPath = path.join(os.homedir(), '.config', 'claude-notifications', 'settings.json');
  const soundsDir = path.join(os.homedir(), '.config', 'claude-notifications', 'sounds');

  console.log('🔍 Claude Notifications Config Debug Info:');
  console.log('');
  console.log('📁 Config file location:');
  console.log(`   ${configPath}`);
  console.log(`   Exists: ${fs.existsSync(configPath) ? '✅' : '❌'}`);

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      console.log('   Content:');
      console.log(`   ${configContent.split('\n').map(line => `   ${line}`).join('\n')}`);
    } catch (error) {
      console.log(`   Error reading: ${error.message}`);
    }
  }

  console.log('');
  console.log('🔊 Sounds directory:');
  console.log(`   ${soundsDir}`);
  console.log(`   Exists: ${fs.existsSync(soundsDir) ? '✅' : '❌'}`);

  if (fs.existsSync(soundsDir)) {
    try {
      const soundFiles = fs.readdirSync(soundsDir);
      console.log('   Files:');
      soundFiles.forEach(file => {
        const filePath = path.join(soundsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } catch (error) {
      console.log(`   Error reading directory: ${error.message}`);
    }
  }

  console.log('');
  console.log('⚙️  Current config values:');
  console.log(`   sound: ${config.sound}`);
  console.log(`   soundType: ${config.soundType}`);
  console.log(`   desktopNotification: ${config.desktopNotification}`);

  console.log('');
  console.log('🎵 Sound file paths:');
  const { SOUND_TYPES, getSoundPath } = require('../lib/config');
  Object.values(SOUND_TYPES).forEach(soundType => {
    const soundPath = getSoundPath(soundType);
    console.log(`   ${soundType}: ${soundPath}`);
    console.log(`   Exists: ${fs.existsSync(soundPath) ? '✅' : '❌'}`);
  });

  console.log('');
  console.log('🔧 Command line args:');
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
